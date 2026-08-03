-- ============================================================
--  Constructor Dan — Sprint 3
--  Migración: tablas presupuestos + items_presupuesto
--  Las tablas `usuarios` y `obras` ya deben existir
-- ============================================================

CREATE TABLE IF NOT EXISTS presupuestos (
  id                INT            NOT NULL AUTO_INCREMENT,
  obra_id           INT            NOT NULL,
  precio_m2         DECIMAL(10,2)  NOT NULL,
  precio_ofertado   DECIMAL(12,2)  NOT NULL COMMENT 'Lo que le dice al patrón (puede estar inflado)',
  pct_rebaja        TINYINT        NOT NULL DEFAULT 0,
  total_con_rebaja  DECIMAL(12,2)  NOT NULL COMMENT 'Lo que termina cobrando',
  ganancia_rebaja   DECIMAL(12,2)  NOT NULL DEFAULT 0 COMMENT 'Ganancia extra por haber ofertado más alto — privado',
  aprobado          TINYINT(1)     NOT NULL DEFAULT 0,
  notas             TEXT           DEFAULT NULL,
  created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_presupuesto_obra FOREIGN KEY (obra_id) REFERENCES obras(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS items_presupuesto (
  id                 INT           NOT NULL AUTO_INCREMENT,
  presupuesto_id     INT           NOT NULL,
  tipo_trabajo       ENUM('carpeta','reboque','piso','ceramico_pared','pared_comun','hormigon_viga','contrapiso','hormigon') NOT NULL,
  cantidad           DECIMAL(8,2)  NOT NULL,
  bolsas_calculadas  DECIMAL(8,2)  NOT NULL,
  material           VARCHAR(30)   NOT NULL,
  kg_por_bolsa       TINYINT       NOT NULL,
  unidad             ENUM('m2','ml','m3') NOT NULL DEFAULT 'm2',
  PRIMARY KEY (id),
  CONSTRAINT fk_item_presupuesto FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE CASCADE,
  INDEX idx_items_presupuesto (presupuesto_id)
);

DESCRIBE presupuestos;
DESCRIBE items_presupuesto;
