import colors from 'colors';

function colorOutput(
  method: (c: string) => string,
  logMsg: string,
  message: string
) {
  console.log(`[${method(logMsg)}] ${message}`);
}

export function error(message: string) {
  colorOutput(colors.red, 'ERROR', message);
}

export function success(message: string) {
  colorOutput(colors.green, 'SUCCESS', message);
}

export function info(message: string) {
  colorOutput(colors.blue, 'INFO', message);
}

export function debug(message: string) {
  colorOutput(colors.cyan, 'DEBUG', message);
}
