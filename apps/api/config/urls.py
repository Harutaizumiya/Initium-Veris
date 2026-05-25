from django.urls import include, path

from common.views import HomePageView, PingView

urlpatterns = [
    path("", HomePageView.as_view(), name="home"),
    path("api/ping", PingView.as_view(), name="api-ping"),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("inventory.urls")),
]
