/*********************************************************************************************
 *   Filename        : ble_motor.c
 *   Description     : Vibration Motor BLE Control (LESC + Just-Works)
 *   Copyright       : (c)JIELI  2011-2019  @ , All Rights Reserved.
 *********************************************************************************************/
#include "system/app_core.h"
#include "system/includes.h"
#include "app_config.h"
#include "app_action.h"
#include "btstack/btstack_task.h"
#include "btstack/bluetooth.h"
#include "user_cfg.h"
#include "vm.h"
#include "btcontroller_modules.h"
#include "bt_common.h"
#include "le_common.h"
#include "gatt_common/le_gatt_common.h"

#if CONFIG_APP_MOTOR_CONTROL

#define LOG_TAG "[BLE_MOTOR]"
#define log_info(x, ...)  printf(LOG_TAG x " ", ## __VA_ARGS__)

/* Include our motor control implementation */
#include "vibration_motor_ble/vm_ble_service.h"
#include "vibration_motor_ble/vm_motor_control.h"

/* Connection handle */
static u16 motor_ble_con_handle = 0;

/* Forward declarations */
static int motor_event_packet_handler(int event, u8 *packet, u16 size, u8 *ext_param);
static uint16_t motor_att_read_callback(hci_con_handle_t connection_handle, uint16_t att_handle, uint16_t offset, uint8_t *buffer, uint16_t buffer_size);
static int motor_att_write_callback(hci_con_handle_t connection_handle, uint16_t att_handle, uint16_t transaction_mode, uint16_t offset, uint8_t *buffer, uint16_t buffer_size);

/* GATT server configuration */
static const gatt_server_cfg_t motor_server_init_cfg = {
    .att_read_cb = &motor_att_read_callback,
    .att_write_cb = &motor_att_write_callback,
    .event_packet_handler = &motor_event_packet_handler,
};

/* GATT control block */
static gatt_ctrl_t motor_gatt_control_block = {
    .mtu_size = 23,
    .cbuffer_size = 512,
    .multi_dev_flag = 0,
    .server_config = &motor_server_init_cfg,
    .client_config = NULL,
    .sm_config = NULL,      /* Set by vm_ble_get_sm_config() at runtime */
    .hci_cb_packet_handler = NULL,
};

/* Connection update parameters */
static uint8_t motor_connection_update_enable = 1;
static const struct conn_update_param_t motor_connection_param_table[] = {
    {16, 24, 10, 600},  /* Interval 20-30ms, latency 10, timeout 6s */
    {12, 28, 10, 600},
    {8,  20, 10, 600},
};

/* Connection update counter */
static uint8_t motor_connection_update_cnt = 0;

/*
 * BLE event handler - handles connection lifecycle
 * This is the main event handler registered with the BLE stack
 */
static int motor_event_packet_handler(int event, u8 *packet, u16 size, u8 *ext_param)
{
    (void)size;
    (void)ext_param;
    
    switch (event) {
        case GATT_COMM_EVENT_CONNECTION_COMPLETE:
            motor_ble_con_handle = little_endian_read_16(packet, 0);
            log_info("Connected: handle=%04x\n", motor_ble_con_handle);
            motor_connection_update_cnt = 0;
            break;

        case GATT_COMM_EVENT_DISCONNECT_COMPLETE:
            log_info("Disconnected: handle=%04x\n", motor_ble_con_handle);
            motor_ble_con_handle = 0;
            motor_connection_update_cnt = 0;
            break;

        case GATT_COMM_EVENT_ENCRYPTION_CHANGE:
            log_info("Encryption enabled: handle=%04x\n", little_endian_read_16(packet, 0));
            break;

        case GATT_COMM_EVENT_CONNECTION_UPDATE_COMPLETE:
            log_info("Connection params updated\n");
            break;

        case GATT_COMM_EVENT_CAN_SEND_NOW:
            break;

        default:
            break;
    }

    return 0;
}

/*
 * ATT read callback - delegates to vm_ble_service
 */
static uint16_t motor_att_read_callback(hci_con_handle_t connection_handle, uint16_t att_handle, uint16_t offset, uint8_t *buffer, uint16_t buffer_size)
{
    /* Get the vm_ble_service's server config and call its read callback */
    const gatt_server_cfg_t *vm_cfg = (const gatt_server_cfg_t *)vm_ble_get_server_config();
    if (vm_cfg && vm_cfg->att_read_cb) {
        return vm_cfg->att_read_cb(connection_handle, att_handle, offset, buffer, buffer_size);
    }
    return 0;
}

/*
 * ATT write callback - delegates to vm_ble_service
 */
static int motor_att_write_callback(hci_con_handle_t connection_handle, uint16_t att_handle, uint16_t transaction_mode, uint16_t offset, uint8_t *buffer, uint16_t buffer_size)
{
    /* Get the vm_ble_service's server config and call its write callback */
    const gatt_server_cfg_t *vm_cfg = (const gatt_server_cfg_t *)vm_ble_get_server_config();
    if (vm_cfg && vm_cfg->att_write_cb) {
        return vm_cfg->att_write_cb(connection_handle, att_handle, transaction_mode, offset, buffer, buffer_size);
    }
    return 0;
}

/*
 * Connection parameter update request
 */
static void motor_send_connetion_update_deal(void)
{
    if (motor_connection_update_cnt < (sizeof(motor_connection_param_table) / sizeof(struct conn_update_param_t))) {
        log_info("Request connection update: %d\n", motor_connection_update_cnt);
        ble_op_conn_param_update(motor_ble_con_handle, &motor_connection_param_table[motor_connection_update_cnt]);
        motor_connection_update_cnt++;
    }
}

/*
 * Initialize BLE module
 */
void motor_ble_module_enable(u8 en)
{
    log_info("BLE module %s\n", en ? "enable" : "disable");

    if (en) {
        /* Initialize our motor control service */
        int ret = vm_ble_service_init();
        if (ret != 0) {
            log_info("Motor service init failed: %d\n", ret);
            return;
        }

        /* Set security configuration from vm_ble_service */
        motor_gatt_control_block.sm_config = vm_ble_get_sm_config();

        /* Initialize BLE stack with our server config (which delegates to vm_ble_service) */
        ble_comm_init(&motor_gatt_control_block);

        log_info("Motor BLE service initialized (LESC + Just-Works)\n");
    } else {
        ble_comm_exit();
    }
}

/*
 * Get connection handle
 */
u16 motor_ble_get_con_handle(void)
{
    return motor_ble_con_handle;
}

/*
 * Connection update enable/disable
 */
void motor_ble_set_update_enable(u8 enable)
{
    motor_connection_update_enable = enable;
}

/*
 * Trigger connection update
 */
void motor_ble_update_conn_param(void)
{
    if (motor_connection_update_enable && motor_ble_con_handle) {
        motor_send_connetion_update_deal();
    }
}

/*
 * Wrapper for SDK testbox/update compatibility
 * The testbox_update.c expects ble_module_enable() to exist
 */
void ble_module_enable(u8 en)
{
    motor_ble_module_enable(en);
}

/*
 * BLE pre-initialization - called before BLE stack starts
 */
void bt_ble_before_start_init(void)
{
    log_info("bt_ble_before_start_init\n");
    /* Early initialization can go here if needed */
}

/*
 * BLE initialization - called by SDK's app_comm_ble.c
 */
void bt_ble_init(void)
{
    log_info("bt_ble_init\n");
    motor_ble_module_enable(1);
}

/*
 * BLE exit - called by SDK's app_comm_ble.c
 */
void bt_ble_exit(void)
{
    log_info("bt_ble_exit\n");
    motor_ble_module_enable(0);
}

#endif /* CONFIG_APP_MOTOR_CONTROL */
