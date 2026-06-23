import { _decorator, Component, Node, Prefab, instantiate, Sprite, SpriteFrame, Vec3, EventTouch, UITransform, Label, Color } from 'cc';
const { ccclass, property } = _decorator;

export enum Player {
    NONE = 0,
    BLACK = 1,
    WHITE = 2
}

@ccclass('GameManager')
export class GameManager extends Component {
    @property({ type: Prefab })
    discPrefab: Prefab | null = null;

    @property({ type: SpriteFrame })
    blackSprite: SpriteFrame | null = null;

    @property({ type: SpriteFrame })
    whiteSprite: SpriteFrame | null = null;

    @property({ type: Node})
    gridArea: Node | null = null;

    @property({ type: Prefab})
    validMovePrefab: Prefab | null = null;

    @property({ type: Label})
    turnLabel: Label | null = null;

    @property({ type: Label})
    giliranLabel: Label | null = null;

    @property({ type: Label})
    blackScoreLabel: Label | null = null;

    @property({ type: Label})
    whiteScoreLabel: Label | null = null;

    private validMoveNodes: Node[] = [];
    private boardData: Player[][] = [];
    private readonly BOARD_SIZE: number = 8;
    private currentPlayer: Player = Player.BLACK; 
    private readonly CELL_SIZE: number = 90;
    private discNodes: (Node | null)[][] = []; 

    //Atribut buat entitas ai nya
    private isAIEnabled: boolean = true;
    private aiPlayer: Player = Player.WHITE;
    private aiSearchDepth: number = 3; //Kedalaman pencarian minimax

    //Bobot posisi papan untuk evaluasi heuristik si entitas ai
    private readonly boardWeights = [
        [100, -20,  10,   5,   5,  10, -20, 100],
        [-20, -50,  -2,  -2,  -2,  -2, -50, -20],
        [ 10,  -2,   1,   1,   1,   1,  -2,  10],
        [  5,  -2,   1,   1,   1,   1,  -2,   5],
        [  5,  -2,   1,   1,   1,   1,  -2,   5],
        [ 10,  -2,   1,   1,   1,   1,  -2,  10],
        [-20, -50,  -2,  -2,  -2,  -2, -50, -20],
        [100, -20,  10,   5,   5,  10, -20, 100]
    ];

    private readonly directions = [
        [-1, 0], [1, 0], [0, -1], [0, 1], 
        [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];

    start() {
        this.initializeBoard();
        this.registerInput();
    }

    private initializeBoard() {
        for (let row = 0; row < this.BOARD_SIZE; row++) {
            this.boardData[row] = [];
            this.discNodes[row] = [];
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                this.boardData[row][col] = Player.NONE;
                this.discNodes[row][col] = null;
            }
        }

        this.boardData[3][3] = Player.WHITE;
        this.boardData[3][4] = Player.BLACK;
        this.boardData[4][3] = Player.BLACK;
        this.boardData[4][4] = Player.WHITE;

        this.renderBoard();
        this.updateTurnUI();
        this.showValidMoves();
        this.updateScoreUI();
    }

    private renderBoard() {
        if (this.gridArea) this.gridArea.removeAllChildren();

        for (let row = 0; row < this.BOARD_SIZE; row++) {
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                let cellPlayer = this.boardData[row][col];
                if (cellPlayer !== Player.NONE) {
                    this.spawnDiscVisually(row, col, cellPlayer);
                }
            }
        }
    }

    private spawnDiscVisually(row: number, col: number, player: Player) {
        let newDisc = instantiate(this.discPrefab);
        let sprite = newDisc.getComponent(Sprite);
        sprite.spriteFrame = player === Player.BLACK ? this.blackSprite : this.whiteSprite;

        let posX = (col * this.CELL_SIZE) + (this.CELL_SIZE / 2);
        let posY = -((row * this.CELL_SIZE) + (this.CELL_SIZE / 2));

        newDisc.setPosition(new Vec3(posX, posY, 0));
        this.gridArea.addChild(newDisc);
        this.discNodes[row][col] = newDisc;
    }

    private tryPlaceDisc(row: number, col: number) {
        if (this.boardData[row][col] !== Player.NONE) return;

        // Gunakan parameter boardData asli untuk eksekusi nyata
        let flippableDiscs = this.getFlippableDiscs(this.boardData, row, col, this.currentPlayer);
        if (flippableDiscs.length === 0) return; 

        this.boardData[row][col] = this.currentPlayer;
        this.spawnDiscVisually(row, col, this.currentPlayer);

        for (let pos of flippableDiscs) {
            this.boardData[pos.r][pos.c] = this.currentPlayer;
            this.flipDiscVisually(pos.r, pos.c, this.currentPlayer);
        }
        
        this.currentPlayer = (this.currentPlayer === Player.BLACK) ? Player.WHITE : Player.BLACK;
        this.checkTurnStatus(); 
    }

    private checkTurnStatus() {
        let currentPlayerMoves = this.getAllValidMoves(this.boardData, this.currentPlayer);

        if (currentPlayerMoves.length > 0) {
            this.updateTurnUI();
            this.showValidMoves();
            this.updateScoreUI();
            
            // --- TRIGGER AI JIKA GILIRANNYA ---
            if (this.isAIEnabled && this.currentPlayer === this.aiPlayer) {
                this.scheduleOnce(() => {
                    this.executeAITurn();
                }, 0.5); // Jeda 0.5 detik agar terlihat seperti sedang berpikir
            }
            return;
        }

        let opponent = (this.currentPlayer === Player.BLACK) ? Player.WHITE : Player.BLACK;
        let opponentMoves = this.getAllValidMoves(this.boardData, opponent);

        if (opponentMoves.length > 0) {
            this.currentPlayer = opponent;
            
            this.updateTurnUI();
            this.showValidMoves();
            this.updateScoreUI();

            if (this.turnLabel) {
                let activePlayerName = (this.currentPlayer === Player.BLACK) ? "Hitam" : "Putih";
                this.turnLabel.string = `${activePlayerName} (Skip!)`;
            }

            // Jika setelah skip ternyata giliran AI, panggil AI lagi
            if (this.isAIEnabled && this.currentPlayer === this.aiPlayer) {
                this.scheduleOnce(() => {
                    this.executeAITurn();
                }, 0.5);
            }
        } else {
            this.updateScoreUI();
            this.handleGameOver();
        }
    }

    private handleGameOver() {
        for (let node of this.validMoveNodes) {
            node.destroy();
        }
        this.validMoveNodes = [];

        let blackCount = 0;
        let whiteCount = 0;
        for (let row = 0; row < this.BOARD_SIZE; row++) {
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                if (this.boardData[row][col] === Player.BLACK) blackCount++;
                else if (this.boardData[row][col] === Player.WHITE) whiteCount++;
            }
        }

        let winnerText = "";
        if (blackCount > whiteCount) winnerText = "HITAM!";
        else if (whiteCount > blackCount) winnerText = "PUTIH (AI)!";
        else winnerText = "SERI!";
        
        if (this.turnLabel) {
            this.giliranLabel.string = `Winner:`;
            this.turnLabel.string = ` ${winnerText}`;
            this.turnLabel.color = blackCount > whiteCount ? new Color(0, 0, 0, 255) : new Color(255, 255, 255, 255);        
        }
    }

    private flipDiscVisually(row: number, col: number, player: Player) {
        let node = this.discNodes[row][col];
        if (node) {
            let sprite = node.getComponent(Sprite);
            sprite.spriteFrame = player === Player.BLACK ? this.blackSprite : this.whiteSprite;
        }
    }

    private registerInput() {
        if (this.gridArea) {
            this.gridArea.on(Node.EventType.TOUCH_END, this.onBoardClicked, this);
        }
    }

    private onBoardClicked(event: EventTouch) {
        // Blokir input pemain jika sedang giliran AI
        if (this.isAIEnabled && this.currentPlayer === this.aiPlayer) return;

        let touchPos = event.getUILocation();
        let uiTransform = this.gridArea.getComponent(UITransform);
        let localPos = uiTransform.convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0));

        let col = Math.floor(localPos.x / this.CELL_SIZE);
        let row = Math.floor(Math.abs(localPos.y) / this.CELL_SIZE);

        if (row >= 0 && row < this.BOARD_SIZE && col >= 0 && col < this.BOARD_SIZE) {
            this.tryPlaceDisc(row, col);
        }
    }

    // --- DIUBAH: Sekarang menerima parameter board agar bisa disimulasikan AI ---
    private getFlippableDiscs(board: Player[][], row: number, col: number, player: Player): {r: number, c: number}[] {
        let flippable: {r: number, c: number}[] = [];
        let opponent = (player === Player.BLACK) ? Player.WHITE : Player.BLACK;

        for (let dir of this.directions) {
            let r = row + dir[0];
            let c = col + dir[1];
            let tempFlippable: {r: number, c: number}[] = [];

            while (r >= 0 && r < this.BOARD_SIZE && c >= 0 && c < this.BOARD_SIZE && board[r][c] === opponent) {
                tempFlippable.push({r: r, c: c});
                r += dir[0];
                c += dir[1];
            }

            if (r >= 0 && r < this.BOARD_SIZE && c >= 0 && c < this.BOARD_SIZE && board[r][c] === player && tempFlippable.length > 0) {
                flippable.push(...tempFlippable); 
            }
        }
        return flippable;
    }

    // --- DIUBAH: Sekarang menerima parameter board ---
    private getAllValidMoves(board: Player[][], player: Player): {r: number, c: number}[] {
        let validMoves: {r: number, c: number}[] = [];
        for (let row = 0; row < this.BOARD_SIZE; row++) {
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                if (board[row][col] === Player.NONE) {
                    let flippable = this.getFlippableDiscs(board, row, col, player);
                    if (flippable.length > 0) {
                        validMoves.push({r: row, c: col});
                    }
                }
            }
        }
        return validMoves;
    }

    private showValidMoves() {
        // Tampilkan indikator hanya jika giliran pemain manusia (Opsional, agar lebih rapi)
        if (this.isAIEnabled && this.currentPlayer === this.aiPlayer) return;

        for (let node of this.validMoveNodes) {
            node.destroy();
        }
        this.validMoveNodes = [];

        let validMoves = this.getAllValidMoves(this.boardData, this.currentPlayer);

        if (this.validMovePrefab) {
            for (let move of validMoves) {
                let indicator = instantiate(this.validMovePrefab);
                let posX = (move.c * this.CELL_SIZE) + (this.CELL_SIZE / 2);
                let posY = -((move.r * this.CELL_SIZE) + (this.CELL_SIZE / 2));
                
                indicator.setPosition(new Vec3(posX, posY, 0));
                this.gridArea.addChild(indicator);
                this.validMoveNodes.push(indicator); 
            }
        }
    }

    private updateTurnUI() {
        if (this.turnLabel) {
            let playerName = (this.currentPlayer === Player.BLACK) ? "Hitam" : "Putih (AI)";
            this.turnLabel.string = `${playerName}`;
            this.turnLabel.color = this.currentPlayer === Player.BLACK ? new Color(0, 0, 0, 255) : new Color(255, 255, 255, 255);
        }
    }

    private updateScoreUI() {
        let blackCount = 0;
        let whiteCount = 0;

        for (let row = 0; row < this.BOARD_SIZE; row++) {
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                if (this.boardData[row][col] === Player.BLACK) blackCount++;
                else if (this.boardData[row][col] === Player.WHITE) whiteCount++;
            }
        }

        if (this.blackScoreLabel) this.blackScoreLabel.string = `Hitam: ${blackCount}`;
        if (this.whiteScoreLabel) this.whiteScoreLabel.string = `Putih: ${whiteCount}`;
    }

    // ==========================================
    // --- BAGIAN LOGIKA AI (MINIMAX + TOP K) ---
    // ==========================================

    private executeAITurn() {
        let validMoves = this.getAllValidMoves(this.boardData, this.aiPlayer);
        if (validMoves.length === 0) return;

        //Array untuk nyimpen skor tiap kemungkinan langkah
        let moveScores: { move: {r: number, c: number}, score: number }[] = [];

        //Ngitung skor semua kemungkinan langkah saat ini
        for (let move of validMoves) {
            let simulatedBoard = this.simulateMove(this.boardData, move.r, move.c, this.aiPlayer);
            let score = this.minimax(simulatedBoard, this.aiSearchDepth - 1, -Infinity, Infinity, false);
            moveScores.push({ move: move, score: score });
        }

        //Sorting dari skor yang paling tinggi
        moveScores.sort((a, b) => b.score - a.score);

        //Ambil 3 langkah terbaik (Atau sesuaikan jika langkah valid kurang dari 3)
        let topK = Math.min(3, moveScores.length);
        let topMoves = moveScores.slice(0, topK);

        //Pilih acak dari top moves
        let randomIndex = Math.floor(Math.random() * topMoves.length);
        let chosenMove = topMoves[randomIndex].move;

        //Eksekusi langkah yang dipilih secara acak dari yang terbaik
        this.tryPlaceDisc(chosenMove.r, chosenMove.c);
    }

    private minimax(board: Player[][], depth: number, alpha: number, beta: number, isMaximizing: boolean): number {
        let currentPlayer = isMaximizing ? this.aiPlayer : (this.aiPlayer === Player.BLACK ? Player.WHITE : Player.BLACK);
        let validMoves = this.getAllValidMoves(board, currentPlayer);

        //Jika mencapai ujung pencarian atau tidak ada langkah tersisa
        if (depth === 0 || validMoves.length === 0) {
            return this.evaluateBoard(board);
        }

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (let move of validMoves) {
                let newBoard = this.simulateMove(board, move.r, move.c, currentPlayer);
                let evalScore = this.minimax(newBoard, depth - 1, alpha, beta, false);
                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break; //Alpha-beta pruning untuk efisiensi
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (let move of validMoves) {
                let newBoard = this.simulateMove(board, move.r, move.c, currentPlayer);
                let evalScore = this.minimax(newBoard, depth - 1, alpha, beta, true);
                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    //Fungsi Evaluasi Heuristik (Menilai kualitas papan)
    private evaluateBoard(board: Player[][]): number {
        let score = 0;
        let opponent = (this.aiPlayer === Player.BLACK) ? Player.WHITE : Player.BLACK;

        for (let row = 0; row < this.BOARD_SIZE; row++) {
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                if (board[row][col] === this.aiPlayer) {
                    score += this.boardWeights[row][col];
                } else if (board[row][col] === opponent) {
                    score -= this.boardWeights[row][col];
                }
            }
        }
        return score;
    }

    // Helper untuk mensimulasikan langkah (Duplikat papan agar tidak merusak UI)
    private simulateMove(board: Player[][], row: number, col: number, player: Player): Player[][] {
        // Clone 2D array
        let newBoard = board.map(arr => [...arr]); 
        
        let flippable = this.getFlippableDiscs(newBoard, row, col, player);
        newBoard[row][col] = player;
        
        for (let pos of flippable) {
            newBoard[pos.r][pos.c] = player;
        }
        
        return newBoard;
    }
}