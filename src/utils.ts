export const b64Decode = (input: string) => {
  return Buffer.from(input, 'base64').toString();
};

/**
 * @param input string to decode
 * @param chart 7 character chart looped over to decode string
 */
export const chartDecode = (input: string, chart: string) => {
  const inputAscii = Buffer.from(input, 'base64').toString();
  let output = '';
  for (let i = 0; i < inputAscii.length; ++i) {
    const currentChartCode = chart.charCodeAt(i % 7);
    const inputCode = inputAscii.charCodeAt(i);
    const charCode = currentChartCode ^ inputCode;
    output += String.fromCharCode(charCode);
  }
  return output;
};

export const standardDecode = (input: string) => {
  const inputAscii = Buffer.from(input, 'base64').toString();
  let output = '';
  for (let i = 1; i < inputAscii.length; ++i) {
    const currentChartCode = inputAscii.charCodeAt(0);
    const inputCode = inputAscii.charCodeAt(i);
    const charCode = currentChartCode ^ inputCode;
    output += String.fromCharCode(charCode);
  }
  return output;
};
