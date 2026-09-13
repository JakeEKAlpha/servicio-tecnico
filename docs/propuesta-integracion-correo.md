# Propuesta: conectar el sistema con correo

Borrador para revisión — nada de esto está implementado todavía. Lo pediste como "prompteitor de una vez cómo se conectará con mi correo"; aquí está el análisis y una recomendación concreta, no solo la pregunta de vuelta.

## El problema real que esto resolvería

Hoy, tres flujos dependen de que un humano copie/pegue o descargue algo manualmente:

1. **Lexmark WO/SR**: el coordinador pega texto en `ModalPegarWOSR` (parseado por `lib/importar/lexmark.ts`).
2. **Xerox**: igual, pegado en `ModalPegarXerox` (`lib/importar/xerox.ts`).
3. **`DATOS WO - LIMPIOS.csv`** (el archivo que tienes en Descargas): es un export manual del portal de Lexmark, que alguien baja, limpia y usa para reconciliar. No hay ningún automatismo que lo traiga solo.

Si Lexmark/Xerox mandan estos datos por correo (notificaciones de WO nuevo, reportes periódicos), conectar el sistema al correo elimina el paso manual de "alguien tiene que entrar al portal y copiar/pegar o descargar".

## 3 formas de hacerlo, de menos a más automático

### Opción A — Reenvío + Webhook (la más simple, la recomendada para empezar)
En Gmail/Workspace, configuras una regla: "todo correo de `noreply@lexmark.com` con asunto que contenga 'Work Order' → reenviar a una dirección especial". Esa dirección especial es en realidad un endpoint tuyo: usas un servicio como **SendGrid Inbound Parse** o **Postmark Inbound** (ambos gratis en volumen bajo) que convierte el correo entrante en un `POST` HTTP a `app/api/importar/correo/route.ts` con el cuerpo del correo ya parseado.

**Qué necesita de ti:** una cuenta en SendGrid/Postmark (gratis), y configurar la regla de reenvío en tu Workspace — 10 minutos, sin tocar código de Google.
**Qué construyo yo:** el endpoint que recibe el webhook, reutilizando `parsearReporteLexmark`/`parsearReporteXerox` que ya existen — el parseo del texto es el mismo, solo cambia de dónde viene el texto (de un textarea a un correo).
**Riesgo:** bajo. No toca tu buzón directamente, solo una regla de reenvío que puedes apagar en un clic.

### Opción B — Gmail API con cuenta de servicio (más integrado, más esfuerzo)
Domain-wide delegation (el mismo mecanismo que ya usas para generar documentos en `lib/google/cliente.ts`) pero con el scope de Gmail (`gmail.readonly`), impersonando tu cuenta o una cuenta dedicada (ej. `automatizacion@alphadigital.com.mx`). Un cron job (necesitarías el endpoint `/api/cron/**` que `lib/supabase/servidor-cron.ts` ya dejó preparado desde antes, sin usar) revisa el buzón cada N minutos y procesa lo nuevo.

**Qué necesita de ti:** habilitar el scope de Gmail en la cuenta de servicio ya existente (Google Cloud Console → tu proyecto → APIs) y decidir qué buzón impersonar.
**Qué construyo yo:** el poller + el endpoint de cron.
**Riesgo:** medio — la cuenta de servicio pasa a tener *lectura* de un buzón de correo real, no solo acceso a Drive/Docs. Hay que ser cuidadoso con el scope (`readonly`, nunca `send` ni `modify`) y decidir bien qué buzón usar (uno dedicado, no tu correo personal).

### Opción C — IMAP directo
Técnicamente posible pero no lo recomiendo: manejar credenciales IMAP en tu backend es más frágil y menos seguro que las dos opciones de arriba, que usan OAuth/tokens de proveedor. Solo tendría sentido si Lexmark/Xerox no dan ninguna otra vía y no quieres pasar por Google Workspace.

## Mi recomendación

Empezar con la **Opción A**. Es la que menos superficie de riesgo agrega (no le das a nada acceso de lectura a tu correo real), es la más rápida de tener funcionando, y si con el tiempo se vuelve limitante, migrar a la Opción B reutiliza casi todo el trabajo (el parseo es el mismo, solo cambia la fuente).

## Lo que decido yo no hacer ahora

No voy a configurar nada de esto sin que confirmes: (1) qué proveedor de correo entrante prefieres (SendGrid/Postmark), (2) si quieres empezar solo con Lexmark WO o también Xerox desde el día uno, y (3) — importante — esto requiere que **tú** crees la cuenta del servicio elegido y hagas la regla de reenvío; es una cuenta externa con tu información de contacto, no algo que yo deba crear en tu nombre.
