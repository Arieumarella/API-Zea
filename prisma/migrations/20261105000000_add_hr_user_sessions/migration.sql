-- Additive migration: satu sesi aktif per akun (single device login).
-- Baris lama (token tanpa klaim session) tetap valid sampai login berikutnya.

CREATE TABLE `user_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `session_id` VARCHAR(100) NOT NULL,
    `device_id` VARCHAR(100) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    UNIQUE INDEX `user_sessions_user_id_key` (`user_id`),
    PRIMARY KEY (`id`)
);
