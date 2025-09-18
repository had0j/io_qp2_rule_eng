/*
Source code is from the 2025.01.19 version, JS estimated to be after ts edited so there will be some messiness, the code below is modified for reference
Removed some unimportant content, added some comments
"MOD_" is shortened for reading convenience, in the original source it's "this.S.setoptions.zenith_",
or "'xxxxxx_reversed' === this.S.setoptions.zenith_mods[0]"

Some variable names, for reference:
level: rank
experience: climb_pts
promotion fatigue: promotion_fatigue, rank_locked_until
Targeting Factor: targetingfactor
Targeting Grace: targetinggrace
various mods: zenith_[mod name]
reverse mods: [mod name]_reverse
unconsecutive hole column change rate: messiness_change
consecutive hole column change rate: messiness_inner
garbage digging difficulty: garbagefavor
garbage gathering: messiness_center
garbage wait time: garbagephase
*/

// Some constant tables
FloorDistance = [0, 50, 150, 300, 450, 650, 850, 1100, 1350, 1650, 1 / 0];
GravityBumps = [0, .48, .3, .3, .3, .3, .3, .3, .3, .3, .3];
GravLockDelay = [0, 30, 29, 28, 27, 26, 24, 22, 20, 18, 16];
GravRevLockDelay = [0, 24, 22, 20, 18, 16, 15, 14, 13, 12, 11];
SpeedrunReq = [7, 8, 8, 9, 9, 10, 0, 0, 0, 0, 0]; // [0] stores the rank to not fall
TargetingGrace = [0, 4.8, 3.9, 2.1, 1.4, 1.3, .9, .6, .4, .3, .2]; // Targeting Grace's "release interval", here the variable name isn't written in full, same with the one below
TargetingGraceRevEx = [0, 1, .9, .8, .7, .6, .5, .4, .3, .2, .1];
RevNoHoldHoleSideChangeChance = [.1, .1, .15, .2, .25, .3, .35, .4, .45, .5, .55];
ReviveLevelIncrease = [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3];
CancelingFatigueBumpCap = [4, 4, 5, 6, 7, 8, 9, 10, 1 / 0, 1 / 0, 1 / 0];
function GetSpeedCap(frame) {
    const t = this.FloorDistance.find((t => frame < t)) - frame;
    return Math.max(0, Math.min(1, t / 5 - .2))
}

// Main loop
function Loop() {
    const frame = this.self.esm.frame;
    let rank = Math.floor(this.S.stats.zenith.rank);
    const height0 = this.S.stats.zenith.altitude; // Track the altitude for getting stuck before floors

    // Experience loss
    if (frame >= this.S.zenith.rank_locked_until) {
        let leakSpeed = _; // Solo: regular 3, Expert 5 | Duo: 3 + amount of players with Expert
        this.S.zenith.climb_pts -= leakSpeed * (rank ** 2 + rank) / 3600 // climb_pts is the current experience
    }

    const nextRankXP = 4 * rank;
    const storedXP = 4 * (rank - 1);
    if (this.S.zenith.climb_pts < 0)
        // Demotion
        if (rank <= 1)
            // Won't fall below rank 0
            this.S.zenith.climb_pts = 0;
        else {
            // Calculate total xp
            this.S.zenith.climb_pts += storedXP;
            this.S.zenith.last_rank_change_was_promote = false;
            rank--;
        }
    else if (this.S.zenith.climb_pts >= nextRankXP) {
        // Clear xp and promote one rank
        this.S.zenith.climb_pts -= nextRankXP;
        this.S.zenith.last_rank_change_was_promote = true;
        this.S.zenith.rank_locked_until = frame + Math.max(60, 60 * (5 - this.S.zenith.promotion_fatigue));
        this.S.zenith.promotion_fatigue++;
        rank++;
    }

    // the no natural xp loss for 5 seconds effect
    if (this.S.zenith.last_rank_change_was_promote && this.S.zenith.climb_pts >= 2 * (rank - 1))
        this.S.zenith.promotion_fatigue = 0;

    // Rank skipping! If there is a large amount of experience after promotion
    this.S.stats.zenith.rank = rank + this.S.zenith.climb_pts / (4 * rank);

    // Some statistics
    this.S.stats.zenith.peakrank = Math.max(this.S.stats.zenith.rank, this.S.stats.zenith.peakrank);
    this.S.stats.zenith.avgrankpts += this.S.stats.zenith.rank;

    const o = this.S.stats.zenith.altitude;
    const floor = me.GetFloorLevel(o);

    if (MOD_expertRev) {
        // 【Expert+】's descent
        this.S.stats.zenith.altitude = Math.max(me.FloorDistance[floor - 1], o - .05 * (floor ** 2 + floor + 10) / 60);
    } else {
        // Climb speed increasing altitude over time
        this.S.stats.zenith.altitude += .25 * rank / 60 * me.GetSpeedCap(o);
    }

    // Smooth altitude changes
    if (this.S.zenith.bonusremaining > 0)
        if (this.S.zenith.bonusremaining <= .05) {
            this.S.stats.zenith.altitude += this.S.zenith.bonusremaining;
            this.S.zenith.bonusremaining = 0;
        }
        else {
            const delta = Math.min(10, .1 * this.S.zenith.bonusremaining);
            this.S.stats.zenith.altitude += delta;
            this.S.zenith.bonusremaining -= delta;
        }

    // Disallow "climb speed increasing altitude over time" route for reaching the next floor
    if (this.S.setoptions.zenith_tutorial && this.S.stats.zenith.altitude >= 50 && this.S.zenith.tutorial.stage > 0 && this.S.zenith.tutorial.stage < 5) {
        this.S.stats.zenith.altitude = Math.min(49.99, height0);
        this.S.zenith.bonusremaining = 0;
    }

    // 【Gravity(+)】
    floor !== this.S.stats.zenith.floor && (
        MOD_gravity ? (this.S.g += me.GravityBumps[floor], this.S.setoptions.locktime = me.GLockDelay[floor]) : MOD_gravityRev && (this.S.g = 20, this.S.setoptions.locktime = me.GRLockDelay[floor]), this.S.zenith.lastfloorchange = frame, 1 === floor ? this.S.glock = 240 : this.S.stats.zenith.splits[floor - 2] = Math.round(this.self.lm.GetGameTime())
    )
    this.S.stats.zenith.floor = floor;

    // 【Expert+】's overtime punishment
    if (MOD_expertRev && frame - this.S.zenith.lastfloorchange > 3600)
        this.S.setoptions.receivemultiplier += .005 / 60;

    // Don't know what this is
    if (this.S.TEMP_zenith_apm_cycle) {
        if (this.S.TEMP_zenith_apm_cycle += this.S.TEMP_zenith_apm / 3600 / 2.5 * (.75 + .5 * this.S.rngex.nextFloat()), this.S.TEMP_zenith_apm_cycle >= 1) {
            this.S.TEMP_zenith_apm_cycle--;
            this.self.atm.FightLines(this.S.rngex.nextFloat() >= .5 ? 4 : 1);
        }
    }

    // Some system's instant death, estimated for use in 【All-Spin+】
    if (this.self.atm.GetPendingGarbageCount() >= this.S.TEMP_zenith_instakill_at)
        this.self.gom.GameOver("garbagesmash");

    // Targeting Factor increasing upon 3/5/7 minutes
    if (frame === 10800 || frame === 18000 || frame === 25200)
        this.S.stats.zenith.targetingfactor++;

    // Release Targeting Grace
    let r = 60 * (MOD_expertRev ? TargetingGrace : TargetingGraceRevEx)[floor];
    if (this.S.stats.zenith.targetinggrace > 0 && frame >= this.S.lastatktime + r) {
        this.S.stats.zenith.targetinggrace--;
        this.S.lastatktime = frame;
    }

    // Refresh for new messiness values
    const messy = (MOD_expert ? .05 : .03) * floor;
    if (MOD_messy) messy += .25;
    if (MOD_messyRev) messy += 1;
    if (MOD_allspinRev) messy += .3;
    this.S.setoptions.messiness_inner = messy;
    this.S.setoptions.messiness_change = 2.5 * messy;
    if (this.S.zenith.maxmessy) {
        this.S.setoptions.messiness_change = 1;
        this.S.setoptions.messiness_inner = 1;
    }

    // Refresh the status of garbage gathering
    this.S.setoptions.messiness_center = this.S.setoptions.messiness_inner <= .15 && floor <= 5;
    if (MOD_volatileRev) {
        this.S.setoptions.garbagefavor = 50
        this.S.setoptions.messiness_center = true
    }

    // Garbage digging difficulty
    this.S.setoptions.garbagefavor = (MOD_expert ? 0 : 33) - 3 * floor - (MOD_messy ? 25 : 0);

    // Garbage waiting time
    this.S.setoptions.garbagephase = MOD_expert ? 66 - 6 * floor : 165 - 15 * floor;
    if (MOD_anyRev && !MOD_expert)
        this.S.setoptions.garbagephase = (MOD_messyRzev || MOD_volatileRev || MOD_doubleholeRev) ? 75 : [75, 75, 75, 75, 75, 75, 75, 60, 45, 30, 15][floor];

    // Garbage protection, change Targeting Factor based on the amount of garbage lines
    if (frame % 15 == 0 && (MOD_messyRev || MOD_doubleholeRev || MOD_allspinRev)) {
        const line = this.self.bm.CountGarbageLinesNoPerma();
        if (line !== this.S.zenith.garbagerowcount) {
            const t = Math.max(0, 2.5 - .5 * this.S.zenith.garbagerowcount);
            const n = Math.max(0, 2.5 - .5 * line);
            this.S.stats.zenith.targetingfactor += n - t;
            this.S.zenith.garbagerowcount = line;
        }
    }
}

// Some functions
function getHolePosition() { // Calculate things related to garbage hole positions, mainly for treating garbage digging difficulty (used Copilot to organize the code, can't ensure complete accuracy)
    let pos = 0;

    if (MOD_volatileRev) t.zenith.garbageahead.shift();

    if (t.setoptions.garbagefavor !== 0) {
        pos = function () {
            const scores = [];

            // If the highest row has a hole and a gray block (garbage row), track the position of the first garbage hole counting from the left as holePosAtTopLine
            // Doesn't really feel right...? Is it that I'm misunderstanding or is the code actually incorrect, I assume that the design goal was to find the hole position of the shallowest garbage row?
            let garbageHolePosAtTop = -1;
            for (let y = field.height - 1; y >= 0; y--) {
                let holePos = -1;
                let isGarbage = false;
                for (let x = 0; x < field.width; x++) {
                    if (holePos === -1 && null === t.board[y][x]) {
                        holePos = x;
                    }
                    if ("gb" === t.board[y][x]) {
                        isGarbage = true;
                    }
                }
                if (holePos !== -1) {
                    if (isGarbage) garbageHolePosAtTop = holePos;
                    break;
                }
            }

            // For every column, find the column's lowest empty cell to track this column's "digging difficulty"
            e: for (let x = 0; x < field.width; x++) {
                for (let y = 0; y < field.height; y++) {
                    if (null !== t.board[y][x]) {
                        const r = garbageHolePosAtTop === -1 ? 0 : Math.abs(x - garbageHolePosAtTop);
                        scores.push([x, (field.height - y) + 5 * r + .1 * t.rngex.nextFloat()]);
                        continue e;
                    }
                }
                scores.push([x, .1 * t.rngex.nextFloat()]);
            }

            // Order the dig difficulty of every column in ascending order
            scores.sort((e, t) => e[1] - t[1]);

            // ((translation work in progress))
            // 根据垃圾挖掘难度计算每列的权重，也就是挑选挖掘难度的倾向
            // favor为0时每一列的权重都是10，也就是等概率，图像画出来是一条直线（虽然0的时候其实会跳过这些步骤，不用这么麻烦），正数的时候就会把这条直线绕中点(4.5，10)顺时针旋转，也就是增加前五项好挖的列的权重，减少后五项不好挖的列的权重（负权重计为0）
            let scoreSum = 0;
            for (let i = 0; i < scores.length; i++) {
                let score = Math.max(0, 10 + t.setoptions.garbagefavor + i * ((20 - 2 * (10 + t.setoptions.garbagefavor)) / 9));
                if (t.setoptions.messiness_nosame && t.lastcolumn === scores[i][0]) score = 0;
                if (MOD_volatileRev && (scores[i][0] < 2 || scores[i][0] >= e.bm.ColumnWidth() - 2)) score = 0;
                scoreSum += score;
                scores[i][2] = scoreSum;
            }

            // 以上一步计算的score为权重进行最终的随机选择（scoreSum是辅助变量，可以不管）
            const r = t.rngex.nextFloat() * scoreSum;
            for (let i = 0; i < scores.length; i++) {
                if (scores[i][2] !== 0 && r <= scores[i][2]) {
                    t.lastcolumn = scores[i][0];
                    return t.lastcolumn;
                }
            }

            // If there is an edge case where nothing gets returned, return 0 (should be the leftmost column?)
            return 0;
        }();
    } else {
        // This block is affected by 【Duo+】 and is outdated
        if (t.setoptions.messiness_nosame && t.lastcolumn !== null) {
            pos = Math.floor(t.rngex.nextFloat() * (e.bm.ColumnWidth() - 1));
            if (pos >= t.lastcolumn) pos++;
        } else {
            pos = Math.floor(t.rngex.nextFloat() * e.bm.ColumnWidth());
        }
        t.lastcolumn = pos;

        if (MOD_volatileRev) {
            t.zenith.garbageahead.push(pos);
            t.lastcolumn = t.zenith.garbageahead[0];
            return t.lastcolumn;
        } else {
            return pos;
        }
    }
}

// Some events
function AwardKill() { // KO
    this.GiveBonus(.25 * Math.floor(this.S.stats.zenith.rank) * (MOD_expertRev ? 8 : 15))
}
function AwardLines(amount, giveHeight = true, giveXP = true) { // Non-Expert line clears: (false, true) / Cancelling (false, true) / Sending (true, true)
    // Add height (affected by mods etc., see Climb Speed chapter's table)
    let dh = .25 * Math.floor(this.S.stats.zenith.rank) * amount * (giveHeight ? 1 : 0);

    // +3m when stuck
    const heightToNextFloor = me.FloorDistance.find((e => this.S.stats.zenith.altitude < e)) - this.S.stats.zenith.altitude - dh - this.S.zenith.bonusremaining;
    if (heightToNextFloor >= 0 && heightToNextFloor <= 2) dh += 3;

    this.GiveBonus(dh);

    // Reward experience when clearing lines
    this.GiveClimbPts((amount + .05) * (giveXP ? 1 : 0));
}
function AwardHasBeenAttacked(amount) { // Attacked
    const spaceRemain = Math.min(18 - this.S.stats.zenith.targetinggrace, amount);
    if (spaceRemain > 0) this.S.stats.zenith.targetinggrace += spaceRemain;
}
function GiveBonus(amount) { // Receive altitude (several methods)
    if (this.S.setoptions.zenith_tutorial && this.S.zenith.tutorial.stage > 0 && this.S.zenith.tutorial.stage < 5)
        amount *= me.GetSpeedCap(this.S.stats.zenith.altitude);
    this.S.zenith.bonusremaining += amount;
    if (this._bonusExpires < this.self.esm.frame) this._bonusCount = 0;
    this._bonusCount += amount;
    this._bonusExpires = this.self.esm.frame + 60;
    this.S.zenith.bonusfromally += amount;
}
