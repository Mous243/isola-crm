-- ISOLA CRM — Schema para Supabase
-- Ejecutar en el SQL Editor de Supabase

create table if not exists clientes (
  id bigint primary key generated always as identity,
  nombre_negocio text not null,
  propietario text,
  telefono text,
  direccion text,
  zona text,
  sector text,
  hora_ideal_visita text,
  frecuencia_visita text default 'semanal',
  productos_habituales text[] default '{}',
  notas_personales text,
  fecha_ultima_visita date,
  fecha_proxima_visita date,
  deuda_pendiente numeric(10,2) default 0,
  moneda_deuda text default 'USD',
  status text default 'activo',
  tags text[] default '{}',
  created_at timestamptz default now()
);

create table if not exists visitas (
  id bigint primary key generated always as identity,
  cliente_id bigint not null references clientes(id) on delete cascade,
  fecha date not null,
  hora_llegada time,
  hora_salida time,
  resultado text not null,
  monto_pedido numeric(10,2) default 0,
  moneda text default 'USD',
  productos_pedidos jsonb default '[]',
  notas_visita text,
  foto_evidencia text,
  created_at timestamptz default now()
);

create table if not exists cobros (
  id bigint primary key generated always as identity,
  cliente_id bigint not null references clientes(id) on delete cascade,
  monto numeric(10,2) not null,
  moneda text default 'USD',
  descripcion text,
  fecha_emision date,
  fecha_vencimiento date not null,
  estado text default 'pendiente',
  recordatorio_enviado boolean default false,
  fecha_recordatorio date,
  created_at timestamptz default now()
);

create table if not exists metas (
  id bigint primary key generated always as identity,
  periodo text not null,
  tipo text not null,
  meta_monto numeric(10,2) default 0,
  meta_visitas int default 0,
  real_monto numeric(10,2) default 0,
  real_visitas int default 0,
  updated_at timestamptz default now(),
  unique(periodo, tipo)
);

create table if not exists productos (
  id bigint primary key generated always as identity,
  codigo text,
  cod_barra text,
  nombre text not null,
  categoria text not null,
  precio_und numeric(10,2) default 0,
  precio_caja numeric(10,2) default 0,
  und_caja int default 1,
  activo boolean default true
);

-- Índices útiles
create index if not exists idx_visitas_fecha on visitas(fecha);
create index if not exists idx_visitas_cliente on visitas(cliente_id);
create index if not exists idx_cobros_vencimiento on cobros(fecha_vencimiento);
create index if not exists idx_cobros_estado on cobros(estado);
create index if not exists idx_productos_categoria on productos(categoria);
