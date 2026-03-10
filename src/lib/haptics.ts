// Haptic feedback wrapper for mobile devices
// Uses the Vibration API (supported on Android Chrome, not iOS Safari)

export function hapticLight() {
  if (navigator.vibrate) {
    navigator.vibrate(10);
  }
}

export function hapticMedium() {
  if (navigator.vibrate) {
    navigator.vibrate(25);
  }
}

export function hapticHeavy() {
  if (navigator.vibrate) {
    navigator.vibrate(50);
  }
}

export function hapticSuccess() {
  if (navigator.vibrate) {
    navigator.vibrate([10, 50, 20]);
  }
}

export function hapticError() {
  if (navigator.vibrate) {
    navigator.vibrate([50, 30, 50]);
  }
}

// Special patterns
export function hapticGacha() {
  if (navigator.vibrate) {
    navigator.vibrate([20, 40, 20, 40, 50]);
  }
}

export function hapticLineClear(lines: number) {
  if (!navigator.vibrate) return;
  if (lines >= 4) {
    navigator.vibrate([30, 20, 30, 20, 50, 30, 80]);
  } else if (lines >= 2) {
    navigator.vibrate([20, 30, 40]);
  } else {
    navigator.vibrate(15);
  }
}
