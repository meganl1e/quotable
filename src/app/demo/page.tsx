import { Suspense } from "react";

import { GameScreen } from "../game/GameScreen";

export default function DemoPage() {
  return (
    <Suspense>
      <GameScreen mode="sample" />
    </Suspense>
  );
}
