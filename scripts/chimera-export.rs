use chimera::anatomy::human::{BODY_MALE, HumanVocalTract, NEUTRAL, rest_tip};

fn main() {
    let mut tract = HumanVocalTract::new(BODY_MALE);
    let mut frames = Vec::new();
    for i in 0..=20 {
        let t = i as f64 / 20.0;
        let mut a = NEUTRAL;
        a.jaw = 0.45;
        a.tb_x = 2.5 + 1.1 * t;
        a.tb_y = 6.1 + 1.35 * t;
        let tip = rest_tip(a.jaw, a.tb_x, a.tb_y);
        a.tt_x = tip.x; a.tt_y = tip.y;
        // The oral cavity ends behind the vibrating embouchure, not at a speech lip slit.
        a.lip_ap = 0.4; a.lip_width = 0.3; a.velum = -0.15;
        let frame = tract.compute_new(&a);
        frames.push(serde_json::json!({"artic": a, "frame": frame}));
    }
    println!("{}", serde_json::to_string(&frames).unwrap());
}
