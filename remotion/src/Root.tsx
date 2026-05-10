import { Composition } from "remotion";
import { ControlPassVideo } from "./ControlPassVideo";

export const RemotionRoot = () => (
  <Composition
    id="control-pass"
    component={ControlPassVideo}
    durationInFrames={300}
    fps={30}
    width={640}
    height={480}
  />
);
