import { Composition } from "remotion";
import { ControlPassVideo } from "./ControlPassVideo";
import { ProLineDrillVideo } from "./ProLineDrillVideo";
import { VerticalJumpVideo } from "./VerticalJumpVideo";
import { ShuttleRunVideo } from "./ShuttleRunVideo";
import { VerticalJumpActionVideo } from "./VerticalJumpActionVideo";
import { FreeThrowVideo } from "./FreeThrowVideo";
import { StarShootingDrillVideo } from "./StarShootingDrillVideo";
import { CrossoverVideo } from "./CrossoverVideo";
import { BetweenTheLegsVideo } from "./BetweenTheLegsVideo";
import { DoubleCrossVideo } from "./DoubleCrossVideo";
import { BetweenLegsCrossVideo } from "./BetweenLegsCrossVideo";
import { SlalomVideo } from "./SlalomVideo";
import { PrecisionVideo } from "./PrecisionVideo";
import { CoordinationVideo } from "./CoordinationVideo";
import { LongPassVideo } from "./LongPassVideo";
import { StraightLineSpeedFootballVideo } from "./StraightLineSpeedFootballVideo";
import { StraightLineSpeedBasketballVideo } from "./StraightLineSpeedBasketballVideo";

const base = { fps: 30, width: 640, height: 480 };

export const RemotionRoot = () => (
  <>
    <Composition id="control-pass" component={ControlPassVideo} durationInFrames={300} {...base} />
    <Composition id="pro-line-drill" component={ProLineDrillVideo} durationInFrames={275} {...base} />
    <Composition id="vertical-jump" component={VerticalJumpVideo} durationInFrames={260} {...base} />
    <Composition id="shuttle-run" component={ShuttleRunVideo} durationInFrames={275} {...base} />
    <Composition id="vertical-jump-action" component={VerticalJumpActionVideo} durationInFrames={240} {...base} />
    <Composition id="free-throw-shooting" component={FreeThrowVideo} durationInFrames={310} {...base} />
    <Composition id="star-shooting-drill" component={StarShootingDrillVideo} durationInFrames={315} {...base} />
    <Composition id="crossover" component={CrossoverVideo} durationInFrames={277} {...base} />
    <Composition id="between-the-legs" component={BetweenTheLegsVideo} durationInFrames={289} {...base} />
    <Composition id="double-cross" component={DoubleCrossVideo} durationInFrames={295} {...base} />
    <Composition id="between-legs-cross" component={BetweenLegsCrossVideo} durationInFrames={325} {...base} />
    <Composition id="slalom" component={SlalomVideo} durationInFrames={295} {...base} />
    <Composition id="precision" component={PrecisionVideo} durationInFrames={305} {...base} />
    <Composition id="coordination" component={CoordinationVideo} durationInFrames={285} {...base} />
    <Composition id="long-pass" component={LongPassVideo} durationInFrames={325} {...base} />
    <Composition id="straight-line-speed-football" component={StraightLineSpeedFootballVideo} durationInFrames={285} {...base} />
    <Composition id="straight-line-speed-basketball" component={StraightLineSpeedBasketballVideo} durationInFrames={285} {...base} />
  </>
);
