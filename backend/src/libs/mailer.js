import nodemailer from 'nodemailer'
import { GMAIL_USER, GMAIL_APP_PASSWORD, MAIL_FROM_NAME } from '../config.js'

// Envío de correos con Gmail (SMTP + contraseña de aplicación). Si faltan las
// credenciales, mailEnabled() es false y quien llame decide qué hacer.

let transporter = null
let habilitado = Boolean(GMAIL_USER && GMAIL_APP_PASSWORD)

if (habilitado) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
  })
}

export const mailEnabled = () => habilitado

// Se llama al arrancar: comprueba las credenciales para avisar en consola
// (igual que checkCloudinary). Si fallan, se desactiva el envío.
export const checkMailer = async () => {
  if (!habilitado) {
    console.log('Correo no configurado (GMAIL_USER / GMAIL_APP_PASSWORD): los enlaces de recuperación se muestran en consola')
    return
  }
  try {
    await transporter.verify()
    console.log(`Correo listo: se envía desde ${GMAIL_USER}`)
  } catch (error) {
    habilitado = false
    console.error('No se pudo conectar con Gmail; revisa GMAIL_USER y GMAIL_APP_PASSWORD:', error.message)
  }
}

// Escapa texto que va dentro del HTML del correo (p. ej. el nombre del usuario)
const escapar = (texto = '') => String(texto)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Plantilla común con los colores del sitio (#010231 y #00897b). Estilos en
// línea porque muchos clientes de correo ignoran las hojas de estilo
const plantilla = ({ titulo, parrafos, boton, nota }) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#333;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;">
        <tr><td style="background:#010231;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:bold;">PadelZone</td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#010231;">${titulo}</h1>
          ${parrafos.map(p => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;">${p}</p>`).join('')}
          ${boton
            ? `<p style="margin:24px 0;text-align:center;">
                <a href="${boton.url}" style="display:inline-block;background:#00897b;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:10px;">${boton.texto}</a>
              </p>
              <p style="margin:0 0 14px;font-size:12px;color:#777;line-height:1.5;">Si el botón no funciona, copia este enlace en tu navegador:<br><a href="${boton.url}" style="color:#00897b;word-break:break-all;">${boton.url}</a></p>`
            : ''}
          ${nota ? `<p style="margin:16px 0 0;font-size:12px;color:#777;line-height:1.5;">${nota}</p>` : ''}
        </td></tr>
        <tr><td style="background:#f4f6fb;padding:14px 28px;font-size:11px;color:#999;text-align:center;">PadelZone · Neiva, Huila · Este es un correo automático, no lo respondas.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

const enviar = ({ para, asunto, html, texto }) => transporter.sendMail({
  from: `"${MAIL_FROM_NAME}" <${GMAIL_USER}>`,
  to: para,
  subject: asunto,
  html,
  text: texto
})

// Correo con el enlace para restablecer la contraseña
export const enviarCorreoRecuperacion = ({ para, nombre, url, minutos }) => enviar({
  para,
  asunto: 'Restablece tu contraseña de PadelZone',
  html: plantilla({
    titulo: 'Restablece tu contraseña',
    parrafos: [
      `Hola ${escapar(nombre)},`,
      'Recibimos una solicitud para restablecer la contraseña de tu cuenta en PadelZone. Haz clic en el botón para elegir una nueva.',
      `El enlace vence en ${minutos} minutos y solo se puede usar una vez.`
    ],
    boton: { texto: 'Restablecer contraseña', url },
    nota: 'Si no fuiste tú, ignora este correo: tu contraseña no cambiará.'
  }),
  texto: `Hola ${nombre},\n\nPara restablecer tu contraseña de PadelZone abre este enlace (vence en ${minutos} minutos):\n${url}\n\nSi no fuiste tú, ignora este correo.`
})

// Aviso de que la contraseña cambió (por si no lo hizo el titular de la cuenta)
export const enviarCorreoContrasenaCambiada = ({ para, nombre, urlLogin }) => enviar({
  para,
  asunto: 'Tu contraseña de PadelZone cambió',
  html: plantilla({
    titulo: 'Tu contraseña se actualizó',
    parrafos: [
      `Hola ${escapar(nombre)},`,
      'La contraseña de tu cuenta en PadelZone se cambió correctamente. Ya puedes iniciar sesión con la nueva.'
    ],
    boton: { texto: 'Iniciar sesión', url: urlLogin },
    nota: 'Si no fuiste tú, solicita de inmediato un nuevo enlace desde "¿Olvidaste tu contraseña?" y contacta al club.'
  }),
  texto: `Hola ${nombre},\n\nLa contraseña de tu cuenta en PadelZone se cambió correctamente.\nSi no fuiste tú, solicita un nuevo enlace desde "¿Olvidaste tu contraseña?" y contacta al club.`
})
