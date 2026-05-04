# Olixxia — TODO

## Base & Infraestructura
- [x] Schema de base de datos completo (precios, ventas, costes, alertas, documentos, noticias)
- [x] Migración inicial con pnpm db:push
- [x] Configuración Docker (Dockerfile + docker-compose)
- [x] Variables de entorno y configuración de motor IA intercambiable

## Backend — APIs y Datos
- [x] Router de precios AOVE: integración EU Agridata API (precios España, Italia, Grecia)
- [x] Scraping/parsing de datos MAPA (boletines semanales)
- [x] Scraping de Oleista.com para precios diarios en origen (integrado en marketData.ts con EU Agridata)
- [x] Router de noticias: integración NewsAPI/GNews para noticias oleícolas (newsService.ts)
- [x] Endpoint de sincronización de datos de mercado (cron/manual)
- [x] Router de alertas: CRUD de alertas por usuario + evaluación de umbrales
- [x] Router de ventas del cliente: CRUD operaciones de venta
- [x] Router de costes del cliente: CRUD costes de producción y almacenamiento
- [x] Router de simulaciones: cálculo de escenarios comerciales
- [x] Router de documentos: subida y gestión de PDFs (boletines MAPA, docs propios)
- [x] Motor IA intercambiable: abstracción para GPT-4, Claude, Mistral
- [x] Router de chatbot: conversación con prompt maestro oleícola + contexto de mercado
- [x] Router de informes: generación de informe semanal en HTML/PDF (reportService.ts)
- [x] Envío de email de informe semanal al usuario registrado (via notifyOwner + informe HTML)
- [x] Endpoint scheduled para informe semanal automático (scheduled.generarInformeSemanal)

## Frontend — Páginas y Componentes
- [x] Landing page con hero, propuesta de valor, CTA y SEO
- [x] Dashboard principal: precios nacionales y regionales en tiempo real
- [x] Gráfico de evolución semanal de precios (Recharts)
- [x] Gráfico de comparativa de campañas históricas (Recharts)
- [x] Tarjetas de métricas clave: precio actual, variación, volatilidad
- [x] Comparativa internacional España vs Italia/Grecia/Túnez
- [x] Chatbot AOVE Insights: modal con flujo guiado (Vender/Comprar/Exportar)
- [x] Chatbot: selección de motor IA (GPT-4/Claude/Mistral) en configuración
- [x] Calculadora de optimización comercial: formulario + resultados + gráfico
- [x] Simulador de escenarios: comparativa real vs optimizado vs escalonado
- [x] Panel de gestión de ventas propias del cliente
- [x] Panel de gestión de costes de producción
- [x] Panel de alertas configurables por precio
- [x] Panel de documentos: subida de PDFs y boletines MAPA
- [x] Sección de noticias del sector oleícola
- [x] Perfil de usuario y configuración de preferencias
- [x] Exportación de informe en HTML desde el dashboard (informes.exportarHTML)

## SEO
- [x] Meta tags dinámicos por página (title, description, og:*)
- [x] Sitemap.xml y robots.txt
- [x] Schema.org JSON-LD para la landing
- [x] Contenido SEO en landing: keywords oleícolas estratégicas

## Tests
- [x] Tests de routers de precios y chatbot
- [x] Tests de calculadora de simulación
- [x] Tests de alertas

## Calculadora Avanzada AOVE (estilo Nexo Dubai)
- [x] Panel izquierdo con sliders: volumen, precio, costes, meses almacenamiento, escenario bajada/subida
- [x] Gráfico 1: Evolución del precio AOVE vs histórico de campañas (líneas)
- [x] Gráfico 2: Beneficio acumulado por escenario a lo largo del tiempo (área)
- [x] Gráfico 3: Comparativa escenarios (barras): vender ahora vs escalonado vs esperar vs pesimista
- [x] Gráfico 4: Volatilidad semanal y zona de riesgo (línea + área sombreada)
- [x] Panel derecho KPIs: RRH, margen neto, beneficio total, multiplicador de capital
- [x] Tabs: Gráficas / Tabla Detallada / Análisis IA
- [x] Tabla detallada de escenarios con todos los parámetros
- [x] Análisis IA con recomendación estratégica y justificación
- [x] Botón "Generar Informe HTML" con exportación
- [x] Indicador circular de RRH (donut chart)
- [x] Break-even point y recuperación de inversión

## Integración Fuentes Reales y Base de Conocimiento
- [x] Actualizar BD con datos reales MAPA semana 17/2026 (precios nacionales + regionales + internacionales)
- [x] Backend: servicio de scraping oleista.com para precios diarios en tiempo real
- [x] Backend: descarga automática boletín MAPA por URL predecible (semana actual)
- [x] Backend: scraping COI/IOC para datos de producción mensual
- [x] Backend: scraping Wikifarmer para análisis semanal de mercado
- [x] Router /api/fuentes: endpoint que devuelve estado de todas las fuentes con última actualización
- [x] Router /api/fuentes/actualizar: trigger manual para actualizar todas las fuentes
- [x] Página "Base de Conocimiento" con panel de fuentes verificadas, links directos y estado
- [x] Botón "Actualizar ahora" que llama a todas las fuentes en tiempo real
- [x] Sello de verificación con timestamp de última actualización por fuente
- [x] Tabla de precios reales actuales en la página de fuentes
- [x] Tests de integración para verificar que las fuentes responden
