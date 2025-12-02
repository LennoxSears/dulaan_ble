#ifndef _BLE_MOTOR_H_
#define _BLE_MOTOR_H_

#include "typedef.h"

/*
 * Initialize/deinitialize BLE motor control module
 */
void motor_ble_module_enable(u8 en);

/*
 * Get current connection handle
 */
u16 motor_ble_get_con_handle(void);

/*
 * Enable/disable connection parameter update
 */
void motor_ble_set_update_enable(u8 enable);

/*
 * Trigger connection parameter update
 */
void motor_ble_update_conn_param(void);

#endif /* _BLE_MOTOR_H_ */
