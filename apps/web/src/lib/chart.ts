import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartArea,
} from "chart.js";

let registered = false;

export function ensureChartJsRegistered(): void {
  if (registered) return;
  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    LineController,
    BarElement,
    BarController,
    ArcElement,
    Filler,
    Tooltip,
    Legend,
  );
  registered = true;
}

function parseColorChannels(color: string): [number, number, number] {
  const rgbMatch = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
  }

  const normalized = color.replace("#", "");
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

export function createAreaGradient(
  ctx: CanvasRenderingContext2D,
  area: ChartArea,
  color: string,
  opacity = 0.25,
): CanvasGradient {
  const [r, g, b] = parseColorChannels(color);
  const gradient = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity})`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  return gradient;
}
