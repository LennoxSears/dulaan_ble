#ifndef VM_MOTOR_CONTROL_H
#define VM_MOTOR_CONTROL_H

#include <stdint.h>

/* Motor control configuration */
#define VM_MOTOR_PWM_FREQ_HZ    20000   /* 20kHz PWM frequency */
#define VM_MOTOR_DUTY_MIN       0       /* 0% duty cycle */
#define VM_MOTOR_DUTY_MAX       255     /* 100% duty cycle */

/* Default motor pin - can be overridden in board config */
#ifndef VM_MOTOR_PWM_PIN
#define VM_MOTOR_PWM_PIN        IO_PORTB_05  /* Example pin */
#endif

/**
 * Initialize motor control
 * Configures PWM peripheral
 * @return 0 on success
 */
int vm_motor_init(void);

/**
 * Set motor duty cycle
 * @param duty Duty cycle 0-255 (0% to 100%)
 */
void vm_motor_set_duty(uint8_t duty);

/**
 * Stop motor
 * Sets duty cycle to 0
 */
void vm_motor_stop(void);

/**
 * Get current duty cycle
 * @return Current duty cycle 0-255
 */
uint8_t vm_motor_get_duty(void);

#endif /* VM_MOTOR_CONTROL_H */
