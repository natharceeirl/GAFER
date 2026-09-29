import request = require('supertest');
import { createTestApp, TestApp } from '../support/app';

describe('Autenticación y Control de Acceso por Roles E2E (GAF-8 / Spec §12)', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/login', () => {
    it('inicia sesión exitosamente como Administrador en la Web', async () => {
      const res = await request(app.baseUrl)
        .post('/api/auth/login')
        .send({
          usuario: 'r.agarate',
          clave: 'Admin123!',
          cliente: 'web',
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.usuario.cargo).toBe('ADMINISTRADOR');
      expect(res.body.usuario.usuario).toBe('R.AGARATE');
    });

    it('inicia sesión exitosamente como Supervisor en la Web', async () => {
      const res = await request(app.baseUrl)
        .post('/api/auth/login')
        .send({
          usuario: 'd.amamani',
          clave: 'Super123!',
          cliente: 'web',
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.usuario.cargo).toBe('SUPERVISOR');
    });

    it('inicia sesión exitosamente como Técnico Operador en la App Móvil', async () => {
      const res = await request(app.baseUrl)
        .post('/api/auth/login')
        .send({
          usuario: 'j.perez',
          clave: 'Tecnico123!',
          cliente: 'mobile',
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.usuario.cargo).toBe('TECNICO_OPERADOR');
    });

    it('RECHAZA con 403 al Técnico Operador si intenta ingresar desde la Web (Spec §12 / C10 / §16)', async () => {
      const res = await request(app.baseUrl)
        .post('/api/auth/login')
        .send({
          usuario: 'j.perez',
          clave: 'Tecnico123!',
          cliente: 'web',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('solo tiene acceso a la aplicación móvil');
    });

    it('rechaza con 401 si las credenciales son incorrectas', async () => {
      const res = await request(app.baseUrl)
        .post('/api/auth/login')
        .send({
          usuario: 'r.agarate',
          clave: 'PasswordIncorrecto',
          cliente: 'web',
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Credenciales inválidas');
    });
  });

  describe('Rutas protegidas y RBAC', () => {
    let adminToken: string;
    let supervisorToken: string;
    let tecnicoToken: string;

    beforeAll(async () => {
      const adminRes = await request(app.baseUrl)
        .post('/api/auth/login')
        .send({ usuario: 'r.agarate', clave: 'Admin123!', cliente: 'web' });
      adminToken = adminRes.body.token;

      const supRes = await request(app.baseUrl)
        .post('/api/auth/login')
        .send({ usuario: 'd.amamani', clave: 'Super123!', cliente: 'web' });
      supervisorToken = supRes.body.token;

      const tecRes = await request(app.baseUrl)
        .post('/api/auth/login')
        .send({ usuario: 'j.perez', clave: 'Tecnico123!', cliente: 'mobile' });
      tecnicoToken = tecRes.body.token;
    });

    it('GET /api/auth/perfil sin token responde 401', async () => {
      const res = await request(app.baseUrl).get('/api/auth/perfil');
      expect(res.status).toBe(401);
    });

    it('GET /api/auth/perfil con token válido devuelve perfil', async () => {
      const res = await request(app.baseUrl)
        .get('/api/auth/perfil')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.cargo).toBe('ADMINISTRADOR');
      expect(res.body.usuario).toBe('R.AGARATE');
    });

    it('GET /api/auth/verificar-admin solo permite a Administrador (Supervisor recibe 403)', async () => {
      const adminRes = await request(app.baseUrl)
        .get('/api/auth/verificar-admin')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.autorizado).toBe(true);

      const supRes = await request(app.baseUrl)
        .get('/api/auth/verificar-admin')
        .set('Authorization', `Bearer ${supervisorToken}`);
      expect(supRes.status).toBe(403);
    });

    it('GET /api/auth/verificar-gestion permite a Administrador y Supervisor pero rechaza a Técnico (403)', async () => {
      const adminRes = await request(app.baseUrl)
        .get('/api/auth/verificar-gestion')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);

      const supRes = await request(app.baseUrl)
        .get('/api/auth/verificar-gestion')
        .set('Authorization', `Bearer ${supervisorToken}`);
      expect(supRes.status).toBe(200);

      const tecRes = await request(app.baseUrl)
        .get('/api/auth/verificar-gestion')
        .set('Authorization', `Bearer ${tecnicoToken}`);
      expect(tecRes.status).toBe(403);
    });
  });
});
