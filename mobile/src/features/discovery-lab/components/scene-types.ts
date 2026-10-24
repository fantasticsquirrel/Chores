export type SceneProps = {
  id: string;
  value: number;
  second: number;
  third: number;
  fourth: number;
  setValue: (n: number) => void;
  setSecond: (n: number) => void;
  setThird: (n: number) => void;
  setFourth: (n: number) => void;
  width: number;
  cx: number;
  cy: number;
};
