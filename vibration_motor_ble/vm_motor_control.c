#include "vm_motor_control.h"
#include "asm/mcpwm.h"
#include "typedef.h"

static uint8_t g_current_duty = 0;
static pwm_ch_num_type g_pwm_channel = pwm_ch0;

int vm_motor_init(void)
{
    struct pwm_platform_data pwm_config = {
        .pwm_aligned_mode = pwm_edge_aligned,
        .pwm_ch_num = pwm_ch0,
        .frequency = VM_MOTOR_PWM_FREQ_HZ,
        .duty = 0,  /* Start with 0% duty */
        .h_pin = VM_MOTOR_PWM_PIN,
        .l_pin = (u8)-1,  /* No complementary pin */
        .complementary_en = 0,  /* No complementary output */
    };
    
    /* Initialize MCPWM */
    mcpwm_init(&pwm_config);
    
    /* Open PWM channel */
    mcpwm_open(g_pwm_channel);
    
    g_current_duty = 0;
    
    return 0;
}

int vm_motor_set_duty(uint8_t duty)
{
    /* Convert 0-255 to 0-10000 (0% to 100% with 0.01% resolution) */
    u16 duty_value = ((u32)duty * 10000) / 255;
    
    /* Set PWM duty cycle */
    /* Note: mcpwm_set_duty returns void in SDK, so we can't check errors */
    mcpwm_set_duty(g_pwm_channel, duty_value);
    
    g_current_duty = duty;
    
    return 0;  /* Success */
}

void vm_motor_stop(void)
{
    vm_motor_set_duty(0);
}

uint8_t vm_motor_get_duty(void)
{
    return g_current_duty;
}
