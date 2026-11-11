/**
 * Gamepad Controller Polling & Analog Smoothing
 * Supports standard gamepads (Xbox, PlayStation, Logitech, Switch Pro, VR controllers)
 * for smooth locomotion, look rotation, and analog sprinting.
 */

export interface GamepadMotionState {
  hasGamepad: boolean;
  moveX: number; // -1 to 1 (strafe left/right)
  moveZ: number; // -1 to 1 (forward/backward, -1 is forward)
  lookX: number; // -1 to 1 (look yaw left/right)
  lookY: number; // -1 to 1 (look pitch up/down)
  isSprinting: boolean;
  actionA: boolean;
  actionB: boolean;
  id?: string;
}

export function pollStandardGamepads(deadzone = 0.14): GamepadMotionState {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) {
    return {
      hasGamepad: false,
      moveX: 0,
      moveZ: 0,
      lookX: 0,
      lookY: 0,
      isSprinting: false,
      actionA: false,
      actionB: false,
    };
  }

  const gamepads = navigator.getGamepads();
  if (!gamepads) {
    return {
      hasGamepad: false,
      moveX: 0,
      moveZ: 0,
      lookX: 0,
      lookY: 0,
      isSprinting: false,
      actionA: false,
      actionB: false,
    };
  }

  for (let i = 0; i < gamepads.length; i++) {
    const gp = gamepads[i];
    if (!gp || !gp.connected) continue;

    const axes = gp.axes || [];
    const buttons = gp.buttons || [];

    // Left stick: axes[0] = X, axes[1] = Y
    let rawMoveX = axes[0] || 0;
    let rawMoveZ = axes[1] || 0;

    // D-Pad buttons: 12 = up, 13 = down, 14 = left, 15 = right
    if (buttons[14]?.pressed) rawMoveX = -1;
    if (buttons[15]?.pressed) rawMoveX = 1;
    if (buttons[12]?.pressed) rawMoveZ = -1;
    if (buttons[13]?.pressed) rawMoveZ = 1;

    // Apply smooth analog deadzone & curved responsiveness
    const moveX =
      Math.abs(rawMoveX) > deadzone
        ? Math.sign(rawMoveX) * Math.pow((Math.abs(rawMoveX) - deadzone) / (1 - deadzone), 1.25)
        : 0;
    const moveZ =
      Math.abs(rawMoveZ) > deadzone
        ? Math.sign(rawMoveZ) * Math.pow((Math.abs(rawMoveZ) - deadzone) / (1 - deadzone), 1.25)
        : 0;

    // Right stick: axes[2] = Look X, axes[3] = Look Y (or axes[5] on some gamepads)
    let rawLookX = axes[2] || 0;
    let rawLookY = axes[3] || 0;
    if (axes.length >= 6 && Math.abs(rawLookX) < 0.05 && Math.abs(rawLookY) < 0.05) {
      if (Math.abs(axes[4] || 0) > 0.05) rawLookX = axes[4] || 0;
      if (Math.abs(axes[5] || 0) > 0.05) rawLookY = axes[5] || 0;
    }

    const lookX =
      Math.abs(rawLookX) > deadzone
        ? Math.sign(rawLookX) * Math.pow((Math.abs(rawLookX) - deadzone) / (1 - deadzone), 1.25)
        : 0;
    const lookY =
      Math.abs(rawLookY) > deadzone
        ? Math.sign(rawLookY) * Math.pow((Math.abs(rawLookY) - deadzone) / (1 - deadzone), 1.25)
        : 0;

    // Sprint trigger buttons: 6 (LT), 7 (RT), 10 (L3 thumb click), or 4/5 (bumpers)
    const isSprinting = Boolean(
      (buttons[6] && buttons[6].value > 0.25) ||
        (buttons[7] && buttons[7].value > 0.25) ||
        buttons[10]?.pressed ||
        buttons[4]?.pressed ||
        buttons[5]?.pressed
    );

    const actionA = Boolean(buttons[0]?.pressed);
    const actionB = Boolean(buttons[1]?.pressed);

    return {
      hasGamepad: true,
      moveX,
      moveZ,
      lookX,
      lookY,
      isSprinting,
      actionA,
      actionB,
      id: gp.id,
    };
  }

  return {
    hasGamepad: false,
    moveX: 0,
    moveZ: 0,
    lookX: 0,
    lookY: 0,
    isSprinting: false,
    actionA: false,
    actionB: false,
  };
}
