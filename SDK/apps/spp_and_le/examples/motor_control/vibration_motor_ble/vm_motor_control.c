#include "vm_motor_control.h"
#include "asm/gpio.h"
#include "typedef.h"
#include "timer.h"

static u16 g_current_duty = 0;

/*
 * Timer PWM initialization - based on manufacturer's implementation
 * Uses TIMER3 with 1kHz frequency
 * Duty cycle: 0-10000 (0% to 100%)
 */
static void timer_pwm_init(JL_TIMER_TypeDef *JL_TIMERx, u32 pwm_io, u32 fre, u32 duty)
{
    /* Configure GPIO for timer PWM output */
    switch ((u32)JL_TIMERx) {
    case (u32)JL_TIMER0:
        gpio_set_fun_output_port(pwm_io, FO_TMR0_PWM, 0, 1);
        break;
    case (u32)JL_TIMER1:
        gpio_set_fun_output_port(pwm_io, FO_TMR1_PWM, 0, 1);
        break;
    case (u32)JL_TIMER2:
        gpio_set_fun_output_port(pwm_io, FO_TMR2_PWM, 0, 1);
        break;
    case (u32)JL_TIMER3:
        bit_clr_ie(IRQ_TIME3_IDX);
        gpio_set_fun_output_port(pwm_io, FO_TMR3_PWM, 0, 1);
        break;
    default:
        return;
    }
    
    u32 u_clk = 24000000;  /* 24MHz clock */
    u32 clk_div = 4;       /* Clock divider */
    
    /* Initialize timer */
    JL_TIMERx->CON = 0;
    JL_TIMERx->CON |= (0b110 << 10);  /* Clock source: STD_24M */
    JL_TIMERx->CON |= (0b0001 << 4);  /* Clock divider: /4 */
    JL_TIMERx->CNT = 0;               /* Clear counter */
    
    /* Set period (frequency): effective_clk / freq = (24MHz / 4) / freq */
    JL_TIMERx->PRD = (u_clk / clk_div) / fre;
    
    /* Set duty cycle: 0-10000 = 0%-100% */
    JL_TIMERx->PWM = (JL_TIMERx->PRD * duty) / 10000;
    
    JL_TIMERx->CON |= (0b01 << 0);  /* Count mode */
    JL_TIMERx->CON |= BIT(8);       /* PWM enable */
    
    /* Configure GPIO */
    gpio_set_die(pwm_io, 1);
    gpio_set_pull_up(pwm_io, 0);
    gpio_set_pull_down(pwm_io, 0);
    gpio_set_direction(pwm_io, 0);
}

/*
 * Set timer PWM duty cycle
 */
static void set_timer_pwm_duty(JL_TIMER_TypeDef *JL_TIMERx, u32 duty)
{
    /* Update PWM duty cycle: 0-10000 = 0%-100% */
    JL_TIMERx->PWM = (JL_TIMERx->PRD * duty) / 10000;
}

int vm_motor_init(void)
{
    /* Initialize TIMER3 PWM: 1kHz, 0% duty (motor off) */
    // printf disabled to reduce firmware size
    
    timer_pwm_init(VM_MOTOR_TIMER, VM_MOTOR_PWM_PIN, VM_MOTOR_PWM_FREQ_HZ, 0);
    
    g_current_duty = 0;
    
    // printf disabled to reduce firmware size
    
    return 0;
}

int vm_motor_set_duty(u16 duty_cycle)
{
    /* Clamp to valid range */
    if (duty_cycle > VM_MOTOR_DUTY_MAX) {
        duty_cycle = VM_MOTOR_DUTY_MAX;
    }
    
    // printf disabled to reduce firmware size
    
    /* Set PWM duty cycle (0-10000 = 0.00%-100.00%) */
    set_timer_pwm_duty(VM_MOTOR_TIMER, duty_cycle);
    
    g_current_duty = duty_cycle;
    
    // printf disabled to reduce firmware size
    
    return 0;
}

void vm_motor_stop(void)
{
    /* Set duty to 0 = motor off (IO low) */
    vm_motor_set_duty(0);
}

void vm_motor_deinit(void)
{
    /* Stop motor */
    vm_motor_stop();
    
    /* Disable timer PWM */
    VM_MOTOR_TIMER->CON &= ~BIT(8);  /* Disable PWM */
    
    /* Disable PWM function and restore GPIO control - manufacturer requirement */
    gpio_disable_fun_output_port(VM_MOTOR_PWM_PIN);
    
    /* Set pin to low output */
    gpio_set_direction(VM_MOTOR_PWM_PIN, 0);
    gpio_set_output_value(VM_MOTOR_PWM_PIN, 0);
}

u16 vm_motor_get_duty(void)
{
    return g_current_duty;
}
