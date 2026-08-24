export type Sky = {
  id: string;
  image_path: string;
  width: number;
  height: number;
  colors: string[];
  created_at: string;
  hidden_from_palette: boolean;
};

export type SkyColorSource = Pick<Sky, "id" | "colors">;
