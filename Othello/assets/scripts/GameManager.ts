import { _decorator, Component, Node, Prefab, instantiate, Sprite, SpriteFrame, Vec3, EventTouch, UITransform } from 'cc';
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
    @property({ type: Node, tooltip: 'Masukkan node GridArea ke sini' })
    gridArea: Node | null = null;

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

    private tryPlaceDisc(row: number, col: number) {
        if (this.boardData[row][col] !== Player.NONE) {
            return;
        }

        // Dapatkan daftar bidak lawan yang bisa dibalik
        let flippableDiscs = this.getFlippableDiscs(row, col, this.currentPlayer);

        // ATURAN OTHELLO: Jika tidak ada yang bisa dibalik, langkah TIDAK VALID!
        if (flippableDiscs.length === 0) {
            console.log("Langkah tidak valid! Harus mengepung bidak lawan.");
            return; 
        }

        // 1. Taruh bidak baru di papan
        this.boardData[row][col] = this.currentPlayer;
        this.spawnDiscVisually(row, col, this.currentPlayer);

        // 2. Balik semua bidak lawan yang terapit (update data & visual)
        for (let pos of flippableDiscs) {
            this.boardData[pos.r][pos.c] = this.currentPlayer; // Update logika
            this.flipDiscVisually(pos.r, pos.c, this.currentPlayer); // Update gambar
        }

        // 3. Ganti giliran
        this.currentPlayer = (this.currentPlayer === Player.BLACK) ? Player.WHITE : Player.BLACK;
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
}

