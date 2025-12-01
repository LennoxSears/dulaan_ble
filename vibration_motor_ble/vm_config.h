#ifndef VM_CONFIG_H
#define VM_CONFIG_H

/*
 * Vibration Motor BLE Protocol Configuration
 * 
 * Customize these settings for your hardware and requirements
 */

/* ========== Hardware Configuration ========== */

/* PWM pin for motor control - override in board config if needed */
#ifndef VM_MOTOR_PWM_PIN
#define VM_MOTOR_PWM_PIN        IO_PORTB_05
#endif

/* PWM frequency in Hz */
#ifndef VM_MOTOR_PWM_FREQ_HZ
#define VM_MOTOR_PWM_FREQ_HZ    20000
#endif

/* ========== Security Configuration ========== */

/* Flash write interval (packets) - balance between wear and safety */
#ifndef VM_COUNTER_FLASH_INTERVAL
#define VM_COUNTER_FLASH_INTERVAL   256
#endif

/* Maximum allowed counter jump (prevents overflow attacks) */
#ifndef VM_COUNTER_MAX_DELTA
#define VM_COUNTER_MAX_DELTA        (1ULL << 30)
#endif

/* ========== BLE Configuration ========== */

/* Device name for advertising */
#ifndef VM_DEVICE_NAME
#define VM_DEVICE_NAME          "VibMotor"
#endif

/* Advertising interval (units of 0.625ms) */
#ifndef VM_ADV_INTERVAL_MIN
#define VM_ADV_INTERVAL_MIN     0x0020  /* 20ms */
#endif

#ifndef VM_ADV_INTERVAL_MAX
#define VM_ADV_INTERVAL_MAX     0x0040  /* 40ms */
#endif

/* Connection parameters */
#ifndef VM_CONN_INTERVAL_MIN
#define VM_CONN_INTERVAL_MIN    0x0006  /* 7.5ms */
#endif

#ifndef VM_CONN_INTERVAL_MAX
#define VM_CONN_INTERVAL_MAX    0x000C  /* 15ms */
#endif

#ifndef VM_CONN_LATENCY
#define VM_CONN_LATENCY         0
#endif

#ifndef VM_CONN_TIMEOUT
#define VM_CONN_TIMEOUT         0x0064  /* 1000ms */
#endif

/* ========== Debug Configuration ========== */

/* Enable debug logging */
#ifndef VM_DEBUG_ENABLE
#define VM_DEBUG_ENABLE         1
#endif

/* Debug log macro */
#if VM_DEBUG_ENABLE
#include <stdio.h>
#define VM_LOG(fmt, ...) printf("[VM_BLE] " fmt "\n", ##__VA_ARGS__)
#else
#define VM_LOG(fmt, ...)
#endif

/* ========== Feature Flags ========== */

/* Enable counter overflow auto-disconnect */
#ifndef VM_AUTO_DISCONNECT_ON_OVERFLOW
#define VM_AUTO_DISCONNECT_ON_OVERFLOW  1
#endif

/* Enable motor safety timeout (auto-stop after N seconds) */
#ifndef VM_MOTOR_SAFETY_TIMEOUT_MS
#define VM_MOTOR_SAFETY_TIMEOUT_MS      0  /* 0 = disabled */
#endif

#endif /* VM_CONFIG_H */
