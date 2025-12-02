#ifndef VM_CONFIG_H
#define VM_CONFIG_H

/*
 * Vibration Motor BLE Protocol Configuration
 * LESC + Just-Works - No application-layer security
 * 
 * Customize these settings for your hardware
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

#endif /* VM_CONFIG_H */
