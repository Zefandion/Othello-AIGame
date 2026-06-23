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

    // --- TAMBAHAN BARU: Referensi ke GridArea ---
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

    // Array untuk menyimpan node indikator agar bisa dihapus saat ganti giliran
    private validMoveNodes: Node[] = [];

    private boardData: Player[][] = [];
    private readonly BOARD_SIZE: number = 8;
    private currentPlayer: Player = Player.BLACK; 
    private readonly CELL_SIZE: number = 90;

    // --- TAMBAHAN BARU ---
    // Matriks untuk menyimpan referensi Node visual agar bisa diubah gambarnya nanti
    private discNodes: (Node | null)[][] = []; 

    // 8 Arah: [baris, kolom] -> Atas, Bawah, Kiri, Kanan, dan 4 Diagonal
    private readonly directions = [
        [-1, 0], [1, 0], [0, -1], [0, 1], 
        [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];

    start() {
        this.initializeBoard();
        this.registerInput(); // Panggil fungsi input saat game mulai
    }

    private initializeBoard() {
        for (let row = 0; row < this.BOARD_SIZE; row++) {
            this.boardData[row] = [];
            this.discNodes[row] = []; // Inisialisasi baris untuk node visual
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                this.boardData[row][col] = Player.NONE;
                this.discNodes[row][col] = null; // Kosongkan node di awal
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
        // Hapus semua bidak visual yang mungkin ada (berguna jika nanti ada tombol Restart)
        if (this.gridArea) {
            this.gridArea.removeAllChildren();
        }

        // Looping untuk mengecek isi matriks 8x8
        for (let row = 0; row < this.BOARD_SIZE; row++) {
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                let cellPlayer = this.boardData[row][col];
                
                // Jika di koordinat tersebut ada pemain (bukan NONE), munculkan bidaknya
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

        // Simpan referensi node ini agar nanti bisa diakses untuk dibalik warnanya!
        this.discNodes[row][col] = newDisc;
    }

    private tryPlaceDisc(row: number, col: number) {
        if (this.boardData[row][col] !== Player.NONE) return;

        let flippableDiscs = this.getFlippableDiscs(row, col, this.currentPlayer);
        if (flippableDiscs.length === 0) return; 

        // Taruh bidak dan balik bidak lawan
        this.boardData[row][col] = this.currentPlayer;
        this.spawnDiscVisually(row, col, this.currentPlayer);

        for (let pos of flippableDiscs) {
            this.boardData[pos.r][pos.c] = this.currentPlayer;
            this.flipDiscVisually(pos.r, pos.c, this.currentPlayer);
        }

        // --- UBAH BAGIAN INI KE BAWAH ---
        
        // 1. Ganti giliran ke pemain berikutnya
        this.currentPlayer = (this.currentPlayer === Player.BLACK) ? Player.WHITE : Player.BLACK;

        // 2. Evaluasi apakah pemain berikutnya bisa jalan, kena skip, atau game over
        this.checkTurnStatus(); 
    }

    // --- TAMBAHAN BARU: Mengevaluasi status giliran ---
    private checkTurnStatus() {
        // 1. Cek ketersediaan langkah untuk pemain saat ini
        let currentPlayerMoves = this.getAllValidMoves(this.currentPlayer);

        if (currentPlayerMoves.length > 0) {
            // Jika ada langkah, permainan berjalan normal
            this.updateTurnUI();
            this.showValidMoves();
            this.updateScoreUI();
            return;
        }

        // 2. Jika pemain saat ini TIDAK punya langkah, cek lawannya
        let opponent = (this.currentPlayer === Player.BLACK) ? Player.WHITE : Player.BLACK;
        let opponentMoves = this.getAllValidMoves(opponent);

        if (opponentMoves.length > 0) {
            // Lawan punya langkah, maka pemain saat ini di-SKIP
            // let skippedPlayerName = (this.currentPlayer === Player.BLACK) ? "Hitam" : "Putih";
            // console.log(`Pemain ${skippedPlayerName} tidak punya langkah valid! Giliran dilewati (Pass).`);
            
            // Kembalikan giliran ke lawan
            this.currentPlayer = opponent;
            
            this.updateTurnUI();
            this.showValidMoves();
            this.updateScoreUI();

            // Beri tahu di UI bahwa giliran di-skip
            if (this.turnLabel) {
                let activePlayerName = (this.currentPlayer === Player.BLACK) ? "Hitam" : "Putih";
                // this.turnLabel.string = `${skippedPlayerName} Pass! Giliran: ${activePlayerName}`;
                this.turnLabel.string = `${activePlayerName}`;

            }
        } else {
            // 3. Jika KEDUA pemain tidak punya langkah, GAME OVER
            this.updateScoreUI();
            this.handleGameOver();
        }
    }

    // --- TAMBAHAN BARU: Menangani kondisi akhir permainan ---
    private handleGameOver() {
        // Bersihkan titik-titik indikator dari layar
        for (let node of this.validMoveNodes) {
            node.destroy();
        }
        this.validMoveNodes = [];

        // Hitung siapa yang menang berdasarkan UI Skor yang terakhir
        let blackCount = 0;
        let whiteCount = 0;
        for (let row = 0; row < this.BOARD_SIZE; row++) {
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                if (this.boardData[row][col] === Player.BLACK) blackCount++;
                else if (this.boardData[row][col] === Player.WHITE) whiteCount++;
            }
        }

        let winnerText = "";
        if (blackCount > whiteCount) {
            winnerText = "HITAM!";
        } else if (whiteCount > blackCount) {
            winnerText = "PUTIH!";
        } else {
            winnerText = "SERI!";
        }

        console.log(`GAME OVER! ${winnerText}`);
        
        // Tampilkan teks kemenangan di Label Giliran
        if (this.turnLabel) {
            this.giliranLabel.string = `Winner:`;
            this.turnLabel.string = ` ${winnerText}`;
            if (blackCount > whiteCount) {
                this.turnLabel.color = new Color(0, 0, 0, 255); 
            } else if (whiteCount > blackCount) {
                this.turnLabel.color = new Color(255, 255, 255, 255); 
            } else {
                this.turnLabel.color = new Color(0, 0, 0, 255); 
            }            
        }
    }

    // Fungsi baru untuk mengganti gambar bidak yang terapit
    private flipDiscVisually(row: number, col: number, player: Player) {
        let node = this.discNodes[row][col];
        if (node) {
            let sprite = node.getComponent(Sprite);
            sprite.spriteFrame = player === Player.BLACK ? this.blackSprite : this.whiteSprite;
        }
    }

    // --- TAMBAHAN BARU: Fungsi Input & Konversi Koordinat ---
    private registerInput() {
        if (this.gridArea) {
            // Pasang 'telinga' untuk mendengarkan event klik/sentuh di area grid
            this.gridArea.on(Node.EventType.TOUCH_END, this.onBoardClicked, this);
        }
    }

    private onBoardClicked(event: EventTouch) {
        // 1. Dapatkan lokasi klik di layar
        let touchPos = event.getUILocation();
        
        // 2. Ubah koordinat layar menjadi koordinat lokal di dalam GridArea
        let uiTransform = this.gridArea.getComponent(UITransform);
        let localPos = uiTransform.convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0));

        // 3. Konversi koordinat (X, Y) menjadi Indeks Matriks (Kolom, Baris)
        // Karena Anchor Point GridArea adalah (0,1) alias pojok kiri atas:
        // Nilai X bergerak ke kanan (positif), Nilai Y bergerak ke bawah (negatif)
        let col = Math.floor(localPos.x / this.CELL_SIZE);
        let row = Math.floor(Math.abs(localPos.y) / this.CELL_SIZE);

        // 4. Pastikan klik tidak keluar dari batas array (0-7)
        if (row >= 0 && row < this.BOARD_SIZE && col >= 0 && col < this.BOARD_SIZE) {
            this.tryPlaceDisc(row, col);
        }
    }

    private getFlippableDiscs(row: number, col: number, player: Player): {r: number, c: number}[] {
        let flippable: {r: number, c: number}[] = [];
        let opponent = (player === Player.BLACK) ? Player.WHITE : Player.BLACK;

        // Cek ke 8 arah satu per satu
        for (let dir of this.directions) {
            let r = row + dir[0];
            let c = col + dir[1];
            let tempFlippable: {r: number, c: number}[] = [];

            // Selama menemukan bidak lawan, terus maju dan catat koordinatnya
            while (r >= 0 && r < this.BOARD_SIZE && c >= 0 && c < this.BOARD_SIZE && this.boardData[r][c] === opponent) {
                tempFlippable.push({r: r, c: c});
                r += dir[0];
                c += dir[1];
            }

            // Jika setelah melewati bidak lawan kita menemukan bidak kita sendiri, 
            // berarti bidak lawan tersebut SAH terapit!
            if (r >= 0 && r < this.BOARD_SIZE && c >= 0 && c < this.BOARD_SIZE && this.boardData[r][c] === player && tempFlippable.length > 0) {
                // Masukkan semua bidak yang terapit di arah ini ke daftar utama
                flippable.push(...tempFlippable); 
            }
        }

        return flippable;
    }

    private getAllValidMoves(player: Player): {r: number, c: number}[] {
        let validMoves: {r: number, c: number}[] = [];
        
        // Looping ke seluruh kotak di papan
        for (let row = 0; row < this.BOARD_SIZE; row++) {
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                // Hanya cek kotak yang kosong
                if (this.boardData[row][col] === Player.NONE) {
                    let flippable = this.getFlippableDiscs(row, col, player);
                    if (flippable.length > 0) {
                        validMoves.push({r: row, c: col});
                    }
                }
            }
        }
        return validMoves;
    }

    private showValidMoves() {
        // 1. Bersihkan indikator dari giliran sebelumnya
        for (let node of this.validMoveNodes) {
            node.destroy();
        }
        this.validMoveNodes = []; // Kosongkan array

        // 2. Dapatkan langkah yang valid untuk pemain saat ini
        let validMoves = this.getAllValidMoves(this.currentPlayer);

        // 3. Munculkan titik di koordinat yang valid
        if (this.validMovePrefab) {
            for (let move of validMoves) {
                let indicator = instantiate(this.validMovePrefab);
                let posX = (move.c * this.CELL_SIZE) + (this.CELL_SIZE / 2);
                let posY = -((move.r * this.CELL_SIZE) + (this.CELL_SIZE / 2));
                
                indicator.setPosition(new Vec3(posX, posY, 0));
                this.gridArea.addChild(indicator);
                
                // Simpan ke array agar nanti bisa dihapus
                this.validMoveNodes.push(indicator); 
            }
        }
    }

    private updateTurnUI() {
        if (this.turnLabel) {
            let playerName = (this.currentPlayer === Player.BLACK) ? "Hitam" : "Putih";
            this.turnLabel.string = `${playerName}`;
            
            // Opsional: Ganti warna teks biar makin interaktif (Hitam/Putih)
            if (this.currentPlayer === Player.BLACK) {
                this.turnLabel.color = new Color(0, 0, 0, 255); // hitam
            } else {
                this.turnLabel.color = new Color(255, 255, 255, 255); // Putih
            }
        }
    }

    private updateScoreUI() {
        let blackCount = 0;
        let whiteCount = 0;

        // Looping ke seluruh kotak untuk menghitung jumlah masing-masing warna
        for (let row = 0; row < this.BOARD_SIZE; row++) {
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                if (this.boardData[row][col] === Player.BLACK) {
                    blackCount++;
                } else if (this.boardData[row][col] === Player.WHITE) {
                    whiteCount++;
                }
            }
        }

        // Update teks pada label di layar
        if (this.blackScoreLabel) {
            this.blackScoreLabel.string = `Hitam: ${blackCount}`;
        }
        if (this.whiteScoreLabel) {
            this.whiteScoreLabel.string = `Putih: ${whiteCount}`;
        }
    }
}



