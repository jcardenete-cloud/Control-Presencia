-- Script de creación de tablas para PostgreSQL
-- Se crean dentro del esquema jcf.

CREATE SCHEMA IF NOT EXISTS jcf;

CREATE TABLE IF NOT EXISTS jcf.fichajes (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    start_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    end_time TIMESTAMP WITHOUT TIME ZONE,
    manual BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS jcf.config (
    id INTEGER PRIMARY KEY,
    hours_per_week NUMERIC(5,2) DEFAULT 38.5,
    hours_per_week_summer NUMERIC(5,2) DEFAULT 35.0,
    daily_hours_winter NUMERIC(5,2) DEFAULT 7.7,
    daily_hours_summer NUMERIC(5,2) DEFAULT 7.0,
    hours_leftover NUMERIC(5,2) DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS jcf.projection_days (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    hours VARCHAR(5) NOT NULL
);

CREATE TABLE IF NOT EXISTS jcf.planned_shifts (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5) NOT NULL
);

CREATE TABLE IF NOT EXISTS jcf.weekly_leftovers (
    id BIGSERIAL PRIMARY KEY,
    week_start DATE NOT NULL UNIQUE,
    leftover NUMERIC(5,2) DEFAULT 0.0
);

INSERT INTO jcf.config (
    id,
    hours_per_week,
    hours_per_week_summer,
    daily_hours_winter,
    daily_hours_summer,
    hours_leftover
)
VALUES (
    1,
    38.5,
    35.0,
    7.7,
    7.0,
    0.0
)
ON CONFLICT (id) DO NOTHING;
