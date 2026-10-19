CREATE DATABASE IF NOT EXISTS campus_lost_found_dev
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'lostfound_app'@'localhost'
IDENTIFIED BY 'CHANGE_THIS_PASSWORD';

ALTER USER 'lostfound_app'@'localhost'
IDENTIFIED BY 'CHANGE_THIS_PASSWORD';

GRANT ALL PRIVILEGES
ON campus_lost_found_dev.*
TO 'lostfound_app'@'localhost';

FLUSH PRIVILEGES;

SHOW GRANTS FOR 'lostfound_app'@'localhost';
