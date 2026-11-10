package com.eldorado.irrigacao.service;

public enum DeviceStatus {
    ONLINE("online"), OFFLINE("offline"), ALERTA("alerta");

    public final String wireValue;

    DeviceStatus(String wireValue) {
        this.wireValue = wireValue;
    }
}
