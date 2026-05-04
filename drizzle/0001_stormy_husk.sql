CREATE TABLE `alertas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`nombre` varchar(128) NOT NULL,
	`categoria` enum('AOVE','AOV','AOL','AOR') DEFAULT 'AOVE',
	`tipoAlerta` enum('precio_supera','precio_baja','variacion_pct') NOT NULL,
	`umbralKg` decimal(10,4),
	`umbralPct` decimal(6,3),
	`activa` boolean DEFAULT true,
	`notificarEmail` boolean DEFAULT true,
	`ultimaEvaluacion` timestamp,
	`ultimaNotificacion` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alertas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversaciones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`titulo` varchar(256),
	`modeloIa` varchar(64) DEFAULT 'gpt-4',
	`mensajes` json NOT NULL,
	`contextoMercado` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversaciones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `costes_cliente` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`costeProduccionKg` decimal(10,4) DEFAULT '2.60',
	`costeAlmacenamientoMes` decimal(10,4) DEFAULT '0.05',
	`capacidadAlmacenKg` decimal(12,2),
	`fechaCosechaInicio` timestamp,
	`fechaFinAlmazara` timestamp,
	`stockActualKg` decimal(12,2) DEFAULT '0',
	`precioObjetivoKg` decimal(10,4),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `costes_cliente_id` PRIMARY KEY(`id`),
	CONSTRAINT `costes_cliente_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `documentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`nombre` varchar(256) NOT NULL,
	`tipo` enum('boletin_mapa','historico_ventas','costes','otro') NOT NULL,
	`storageKey` text NOT NULL,
	`storageUrl` text NOT NULL,
	`tamanoBytes` int,
	`extractoTexto` text,
	`procesado` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documentos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `informes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`semanaIso` varchar(10) NOT NULL,
	`titulo` varchar(256),
	`resumenIa` text,
	`recomendacion` text,
	`htmlContent` text,
	`precioReferencia` decimal(10,2),
	`tendencia` varchar(16),
	`enviado` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `informes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `noticias` (
	`id` int AUTO_INCREMENT NOT NULL,
	`titulo` text NOT NULL,
	`descripcion` text,
	`url` text NOT NULL,
	`fuente` varchar(128),
	`imagen` text,
	`publicadoEn` timestamp,
	`categoria` varchar(64) DEFAULT 'mercado',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `noticias_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `precios_internacionales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`semanaIso` varchar(10) NOT NULL,
	`fechaInicio` timestamp NOT NULL,
	`fechaFin` timestamp NOT NULL,
	`pais` varchar(64) NOT NULL,
	`codigoPais` varchar(4) NOT NULL,
	`producto` varchar(128) NOT NULL,
	`mercado` varchar(128),
	`precio100kg` decimal(10,2),
	`moneda` varchar(8) DEFAULT 'EUR',
	`anioMarketing` varchar(10),
	`fuente` varchar(32) DEFAULT 'EU_AGRIDATA',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `precios_internacionales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `precios_mapa` (
	`id` int AUTO_INCREMENT NOT NULL,
	`semanaIso` varchar(10) NOT NULL,
	`fechaInicio` timestamp NOT NULL,
	`categoria` enum('AOVE','AOV','AOL','AOR') NOT NULL,
	`precioNacional100kg` decimal(10,2),
	`precioAndalucia100kg` decimal(10,2),
	`precioJaen100kg` decimal(10,2),
	`precioCórdoba100kg` decimal(10,2),
	`precioSevilla100kg` decimal(10,2),
	`tendenciaPct` decimal(6,3),
	`fuente` text,
	`rawData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `precios_mapa_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `simulaciones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`nombre` varchar(128),
	`estrategia` enum('real','escalonada','optimizada','ventanas','personalizada') NOT NULL,
	`volumenTotalKg` decimal(12,2) NOT NULL,
	`precioMedioEstimadoKg` decimal(10,4),
	`costeProduccionKg` decimal(10,4),
	`costeAlmacenamientoKg` decimal(10,4),
	`margenEstimadoKg` decimal(10,4),
	`beneficioEstimadoTotal` decimal(14,2),
	`escenarios` json,
	`recomendacionIa` text,
	`observaciones` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `simulaciones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ventas_cliente` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fechaVenta` timestamp NOT NULL,
	`semanaIso` varchar(10),
	`provincia` varchar(64),
	`categoria` enum('AOVE','AOV','AOL','AOR') NOT NULL,
	`volumenKg` decimal(12,2) NOT NULL,
	`precioVentaKg` decimal(10,4) NOT NULL,
	`canalVenta` enum('granel','exportacion','embotellado','cooperativa','otro'),
	`observaciones` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ventas_cliente_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `preferredAiModel` varchar(64) DEFAULT 'gpt-4';--> statement-breakpoint
ALTER TABLE `users` ADD `organizationName` text;--> statement-breakpoint
ALTER TABLE `users` ADD `organizationType` enum('almazara','cooperativa','corredor','exportador','inversor','otro');--> statement-breakpoint
ALTER TABLE `users` ADD `province` varchar(64);