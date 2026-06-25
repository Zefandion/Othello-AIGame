import { _decorator, Component, Node, tween, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ButtonPulse')
export class ButtonPulse extends Component {
    @property()
    maxScale: number = 1.08;

    @property()
    duration: number = 0.6;

    private originalScale: Vec3 = new Vec3(1, 1, 1);

    start() {
        this.originalScale = this.node.getScale().clone();
        this.startPulseAnimation();
    }

    private startPulseAnimation() {
        let targetScale = new Vec3(
            this.originalScale.x * this.maxScale,
            this.originalScale.y * this.maxScale,
            this.originalScale.z
        );

        tween(this.node)
            .to(this.duration, { scale: targetScale }, { easing: 'sineOut' })
            .to(this.duration, { scale: this.originalScale }, { easing: 'sineIn' })
            .union()
            .repeatForever() 
            .start(); 
    }
}