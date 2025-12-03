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

/* Advertising data */
static u8 motor_adv_data[31];
static u8 motor_scan_rsp_data[31];
static adv_cfg_t motor_server_adv_config;

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
 * Setup advertising data
 */
static int motor_make_set_adv_data(void)
{
    u8 *buf = motor_adv_data;
    u8 offset = 0;
    
    /* Flags */
    buf[offset++] = 2;
    buf[offset++] = 0x01;  /* Flags type */
    buf[offset++] = 0x06;  /* LE General Discoverable, BR/EDR not supported */
    
    /* Complete local name */
    u8 name_len = strlen("VibMotor");
    buf[offset++] = name_len + 1;
    buf[offset++] = 0x09;  /* Complete local name type */
    memcpy(&buf[offset], "VibMotor", name_len);
    offset += name_len;
    
    motor_server_adv_config.adv_data_len = offset;
    motor_server_adv_config.adv_data = motor_adv_data;
    
    return 0;
}

/*
 * Setup scan response data
 */
static int motor_make_set_rsp_data(void)
{
    u8 *buf = motor_scan_rsp_data;
    u8 offset = 0;
    
    /* 128-bit Service UUID */
    buf[offset++] = 17;
    buf[offset++] = 0x07;  /* Complete list of 128-bit UUIDs */
    /* Service UUID: 9A501A2D-594F-4E2B-B123-5F739A2D594F (little-endian) */
    buf[offset++] = 0x4F;
    buf[offset++] = 0x59;
    buf[offset++] = 0x2D;
    buf[offset++] = 0x9A;
    buf[offset++] = 0x73;
    buf[offset++] = 0x5F;
    buf[offset++] = 0x23;
    buf[offset++] = 0xB1;
    buf[offset++] = 0x2B;
    buf[offset++] = 0x4E;
    buf[offset++] = 0x4F;
    buf[offset++] = 0x59;
    buf[offset++] = 0x2D;
    buf[offset++] = 0x1A;
    buf[offset++] = 0x50;
    buf[offset++] = 0x9A;
    
    motor_server_adv_config.rsp_data_len = offset;
    motor_server_adv_config.rsp_data = motor_scan_rsp_data;
    
    return 0;
}

/*
 * Configure advertising
 */
static void motor_adv_config_set(void)
{
    motor_make_set_adv_data();
    motor_make_set_rsp_data();
    
    motor_server_adv_config.adv_interval = 160;  /* 100ms */
    motor_server_adv_config.adv_auto_do = 1;     /* Auto start advertising */
    motor_server_adv_config.adv_type = ADV_IND;  /* Connectable undirected */
    motor_server_adv_config.adv_channel = ADV_CHANNEL_ALL;
    memset(motor_server_adv_config.direct_address_info, 0, 7);
    
    ble_gatt_server_set_adv_config(&motor_server_adv_config);
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
        /* BLE stack already initialized in bt_ble_before_start_init */
        log_info("Motor BLE service ready\n");
    } else {
        /* Disable handled in bt_ble_exit() */
        log_info("Motor BLE service disabled\n");
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
    ble_comm_module_enable(en);
}

/*
 * Motor server initialization - sets up GATT profile and advertising
 */
static void motor_server_init(void)
{
    log_info("motor_server_init\n");
    
    /* Initialize motor control service */
    int ret = vm_ble_service_init();
    if (ret != 0) {
        log_info("Motor service init failed: %d\n", ret);
        return;
    }
    
    /* Setup advertising */
    motor_adv_config_set();
}

/*
 * BLE pre-initialization - called before BLE stack starts
 * This is where ble_comm_init should be called (like trans_data)
 */
void bt_ble_before_start_init(void)
{
    log_info("bt_ble_before_start_init\n");
    
    /* Set security configuration from vm_ble_service */
    motor_gatt_control_block.sm_config = vm_ble_get_sm_config();
    
    /* Initialize BLE communication stack */
    ble_comm_init(&motor_gatt_control_block);
}

/*
 * BLE initialization - called by SDK's app_comm_ble.c after stack starts
 */
void bt_ble_init(void)
{
    log_info("bt_ble_init\n");
    
    /* Initialize server (profile + advertising) */
    motor_server_init();
    
    /* Enable BLE module */
    ble_comm_module_enable(1);
}

/*
 * BLE exit - called by SDK's app_comm_ble.c
 */
void bt_ble_exit(void)
{
    log_info("bt_ble_exit\n");
    
    /* Disable module */
    motor_ble_module_enable(0);
    
    /* Note: ble_comm_exit() is called by SDK's btstack_ble_exit() 
     * in app_comm_ble.c, so we don't need to call it here */
}

#endif /* CONFIG_APP_MOTOR_CONTROL */
