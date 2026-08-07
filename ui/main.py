import flet as ft

from ui.api_client import APIClient
from ui.views.expenses_view import ExpensesView

# These will be implemented next
from ui.views.home_view import HomeView
from ui.views.inbox_view import InboxView
from ui.views.login_view import LoginView


async def main(page: ft.Page):
    page.title = "Expense Tracker"
    page.theme_mode = ft.ThemeMode.DARK
    page.bgcolor = ft.colors.BACKGROUND
    
    # Initialize API Client
    api_client = APIClient()
    
    # Global Bottom Navigation Bar
    def on_nav_change(e):
        idx = e.control.selected_index
        if idx == 0:
            page.go("/home")
        elif idx == 1:
            page.go("/inbox")
        elif idx == 2:
            page.go("/expenses")
            
    bottom_nav = ft.NavigationBar(
        destinations=[
            ft.NavigationBarDestination(icon=ft.icons.HOME_OUTLINED, selected_icon=ft.icons.HOME, label="Home"),
            ft.NavigationBarDestination(icon=ft.icons.INBOX_OUTLINED, selected_icon=ft.icons.INBOX, label="Inbox"),
            ft.NavigationBarDestination(icon=ft.icons.LIST_ALT_OUTLINED, selected_icon=ft.icons.LIST_ALT, label="Expenses"),
        ],
        selected_index=0,
        on_change=on_nav_change,
        visible=False  # Hidden on login page
    )
    
    page.navigation_bar = bottom_nav

    async def route_change(e: ft.RouteChangeEvent):
        page.views.clear()
        
        # Check authentication on route change
        is_auth = await api_client.check_session()
        
        if not is_auth and page.route != "/login":
            page.go("/login")
            return
            
        if page.route == "/login":
            if is_auth:
                page.go("/home")
                return
            bottom_nav.visible = False
            page.views.append(await LoginView(page, api_client))
            
        elif page.route == "/home":
            bottom_nav.visible = True
            bottom_nav.selected_index = 0
            page.views.append(await HomeView(page, api_client))
            
        elif page.route == "/inbox":
            bottom_nav.visible = True
            bottom_nav.selected_index = 1
            page.views.append(await InboxView(page, api_client))
            
        elif page.route == "/expenses":
            bottom_nav.visible = True
            bottom_nav.selected_index = 2
            page.views.append(await ExpensesView(page, api_client))
            
        page.update()

    def view_pop(e: ft.ViewPopEvent):
        page.views.pop()
        top_view = page.views[-1]
        page.go(top_view.route)

    page.on_route_change = route_change
    page.on_view_pop = view_pop
    
    # Trigger initial route
    page.go(page.route if page.route else "/home")

if __name__ == "__main__":
    # We use asyncio mode since our api_client uses httpx.AsyncClient
    ft.app(target=main, port=8550, view=ft.AppView.WEB_BROWSER)
