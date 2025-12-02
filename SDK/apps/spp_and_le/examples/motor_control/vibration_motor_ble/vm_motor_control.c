#include "vm_motor_control.h"
#include "asm/mcpwm.h"
#include "asm/gpio.h"
#include "typedef.h"

static uint16_t g_current_duty = 0;
static pwm_ch_num_type g_pwm_channel = pwm_ch0;
static pwm_timer_num_type g_pwm_timer = pwm_timer0;

int vm_motor_init(void)
{
    struct pwm_platform_data pwm_config = {
        .pwm_aligned_mode = pwm_edge_aligned,
        .pwm_ch_num = pwm_ch0,
        .pwm_timer_num = pwm_timer0,
        .frequency = VM_MOTOR_PWM_FREQ_HZ,
        .duty = 0,  /* Start with 0% duty */
        .h_pin = VM_MOTOR_PWM_PIN,
        .l_pin = (u8)-1,  /* No complementary pin */
        .complementary_en = 0,  /* No complementary output */
    };
    
    /* Initialize MCPWM */
    mcpwm_init(&pwm_config);
    
    /* Open PWM channel */
    mcpwm_open(g_pwm_channel, g_pwm_timer);
    
    g_current_duty = 0;
    
    return 0;
}

int vm_motor_set_duty(uint16_t duty_cycle)
{
    /* Clamp to valid range */
    if (duty_cycle > VM_MOTOR_DUTY_MAX) {
        duty_cycle = VM_MOTOR_DUTY_MAX;
    }
    
    /* Set PWM duty cycle (0-10000 = 0.00%-100.00%) */
    mcpwm_set_duty(g_pwm_channel, g_pwm_timer, duty_cycle);
    
    g_current_duty = duty_cycle;
    
    return 0;
}

void vm_motor_stop(void)
{
    vm_motor_set_duty(0);
}

void vm_motor_deinit(void)
{
    /* Stop motor before closing */
    vm_motor_stop();
    
    /* Close PWM channel */
    mcpwm_close(g_pwm_channel, g_pwm_timer);
}

uint16_t vm_motor_get_duty(void)
{
    return g_current_duty;
}
