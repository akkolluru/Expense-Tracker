import flet as ft
from ui.api_client import APIClient

async def LoginView(page: ft.Page, api_client: APIClient):
    
    username_field = ft.TextField(
        label="Username",
        width=300,
        bgcolor=ft.colors.SURFACE_VARIANT,
        border_radius=8,
    )
    
    password_field = ft.TextField(
        label="Password",
        password=True,
        can_reveal_password=True,
        width=300,
        bgcolor=ft.colors.SURFACE_VARIANT,
        border_radius=8,
        on_submit=lambda e: login_clicked(e),
    )
    
    error_text = ft.Text(color=ft.colors.ERROR, visible=False)
    
    async def login_clicked(e):
        error_text.visible = False
        page.update()
        
        username = username_field.value
        password = password_field.value
        
        if not username or not password:
            error_text.value = "Please enter username and password"
            error_text.visible = True
            page.update()
            return
            
        success = await api_client.login(username, password)
        if success:
            page.go("/home")
        else:
            error_text.value = "Invalid credentials"
            error_text.visible = True
            page.update()

    login_button = ft.ElevatedButton(
        "Login",
        width=300,
        height=50,
        style=ft.ButtonStyle(
            shape=ft.RoundedRectangleBorder(radius=8),
            bgcolor=ft.colors.PRIMARY,
            color=ft.colors.ON_PRIMARY,
        ),
        on_click=login_clicked,
    )

    return ft.View(
        "/login",
        controls=[
            ft.Container(
                content=ft.Column(
                    controls=[
                        ft.Icon(ft.icons.ACCOUNT_BALANCE_WALLET, size=64, color=ft.colors.PRIMARY),
                        ft.Text("Expense Tracker", size=24, weight=ft.FontWeight.BOLD),
                        ft.Container(height=20),
                        username_field,
                        password_field,
                        error_text,
                        ft.Container(height=10),
                        login_button,
                    ],
                    alignment=ft.MainAxisAlignment.CENTER,
                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                ),
                alignment=ft.alignment.center,
                expand=True,
            )
        ],
        bgcolor=ft.colors.BACKGROUND,
        padding=0,
    )
