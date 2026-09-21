// Solve a projective transform from a rectangle onto four independently measured corners.
// Corner order is top-left, top-right, bottom-right, bottom-left.
export function projectiveMatrix(width, height, corners) {
  const source = [[0, 0], [width, 0], [width, height], [0, height]];
  const rows = source.flatMap(([x, y], i) => {
    const [u, v] = corners[i];
    return [[x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]];
  });
  for (let column = 0; column < 8; column++) {
    let pivot = column;
    for (let row = column + 1; row < 8; row++) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    if (Math.abs(divisor) < 1e-12) throw new Error('Degenerate monitor quadrilateral');
    rows[column] = rows[column].map(value => value / divisor);
    for (let row = 0; row < 8; row++) {
      if (row === column) continue;
      const factor = rows[row][column];
      rows[row] = rows[row].map((value, index) => value - factor * rows[column][index]);
    }
  }
  const [a, b, c, d, e, f, g, h] = rows.map(row => row[8]);
  return [a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1];
}

// Dark glass boundary fitted from the ORIGINAL 1672×941 typing image, not a preview.
// The right edge leans 15.47 source pixels; treating it as vertical crosses the bezel.
export const MONITOR_CORNERS = [[770.07, 161.92], [1322.13, 215.79], [1306.66, 563.98], [771.40, 486.27]];
export const MONITOR_GLASS = 'M782.07 163.09 L1307.13 214.33 Q1322.13 215.79 1321.46 230.79 L1306.66 563.98 L771.40 486.27 L770.12 173.92 Q770.07 161.92 782.07 163.09 Z';
