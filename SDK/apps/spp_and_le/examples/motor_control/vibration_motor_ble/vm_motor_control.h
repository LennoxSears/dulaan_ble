#ifndef VM_MOTOR_CONTROL_H
#define VM_MOTOR_CONTROL_H

#include <stdint.h>
#include "vm_config.h"

/* Motor control configuration */
#define VM_MOTOR_DUTY_MIN       0       /* 0.00% duty cycle */
#define VM_MOTOR_DUTY_MAX       10000   /* 100.00% duty cycle */

/**
 * Initialize motor control
 * Configures PWM peripheral
 * @return 0 on success
 */
int vm_motor_init(void);

/**
 * Set motor duty cycle
 * @param duty_cycle Duty cycle 0-10000 (0.00% to 100.00%)
 * @return 0 on success, negative on error
 */
int vm_motor_set_duty(uint16_t duty_cycle);

/**
 * Stop motor
 * Sets duty cycle to 0
 */
void vm_motor_stop(void);

/**
 * Get current duty cycle
 * @return Current duty cycle 0-10000
 */
uint16_t vm_motor_get_duty(void);

#endif /* VM_MOTOR_CONTROL_H */
