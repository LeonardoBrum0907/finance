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

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

export function createAreaGradient(
  ctx: CanvasRenderingContext2D,
  area: ChartArea,
  hexColor: string,
  opacity = 0.25,
): CanvasGradient {
  const [r, g, b] = hexToRgb(hexColor);
  const gradient = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity})`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  return gradient;
}
