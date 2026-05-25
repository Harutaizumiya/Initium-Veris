from django.test import TestCase


class PingViewTests(TestCase):
    def test_ping_returns_pong(self):
        response = self.client.get("/api/ping")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["content-type"], "text/plain")
        self.assertEqual(response.content, b"pong")
