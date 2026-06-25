import { _decorator, Component, Node, tween, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ButtonPulse')
export class ButtonPulse extends Component {
    @property({ tooltip: 'Skala maksimal saat membesar (1.1 berarti 110%)' })
    maxScale: number = 1.08;

    @property({ tooltip: 'Durasi satu kali animasi membesar/mengecil (detik)' })
    duration: number = 0.6;

    private originalScale: Vec3 = new Vec3(1, 1, 1);

    start() {
        // Catat ukuran asli tombol saat game dimulai
        this.originalScale = this.node.getScale().clone();
        this.startPulseAnimation();
    }

    private startPulseAnimation() {
        // Hitung target ukuran saat membesar
        let targetScale = new Vec3(
            this.originalScale.x * this.maxScale,
            this.originalScale.y * this.maxScale,
            this.originalScale.z
        );

        // Jalankan animasi looping menggunakan sistem Tween Cocos
        tween(this.node)
            .to(this.duration, { scale: targetScale }, { easing: 'sineOut' }) // Membesar halus
            .to(this.duration, { scale: this.originalScale }, { easing: 'sineIn' }) // Mengecil halus
            .union() // Gabungkan kedua animasi di atas
            .repeatForever() // Ulangi terus-menerus tanpa henti
            .start(); // Jalankan!
    }
}