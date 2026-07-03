"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ApiResponse {
    statusCode;
    message;
    data;
    constructor(statusCode, message, data) {
        this.statusCode = statusCode;
        this.message = message;
        if (data) {
            this.data = data;
        }
    }
}
exports.default = ApiResponse;
