// Service worker — solo para push notifications. No cachea nada (Next.js
// ya sirve todo dinámico); su único trabajo es mostrar la notificación
// cuando llega un push y abrir la app al tocarla.

self.addEventListener("push", (event) => {
  let datos = { titulo: "Servicio Técnico", cuerpo: "" };
  try {
    if (event.data) datos = event.data.json();
  } catch {
    // Si el payload no es JSON válido, se muestra el mensaje genérico
    // de arriba en vez de tronar el service worker.
  }

  const opciones = {
    body: datos.cuerpo || "",
    icon: "/icon.png",
    badge: "/icon.png",
    data: { url: datos.url || "/tablero" },
  };

  event.waitUntil(self.registration.showNotification(datos.titulo, opciones));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/tablero";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((lista) => {
        // Si ya hay una pestaña de la app abierta, la reusa y navega ahí
        // en vez de abrir una ventana nueva.
        for (const cliente of lista) {
          if ("focus" in cliente) {
            cliente.navigate(url);
            return cliente.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
