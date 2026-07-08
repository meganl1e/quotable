import { Suspense } from "react";

import { GameScreen } from "./GameScreen";

export default function GamePage() {
  return (
    <Suspense>
      <GameScreen />
    </Suspense>
  );
}
