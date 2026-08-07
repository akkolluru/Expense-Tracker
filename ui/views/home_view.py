import flet as ft
from ui.api_client import APIClient

# Helper mapping for category colors
CATEGORY_COLORS = {
    "food": ft.colors.YELLOW_600,
    "travel": ft.colors.BLUE_500,
    "shopping": ft.colors.PINK_400,
    "utilities": ft.colors.GREEN_500,
    "housing": ft.colors.ORANGE_500,
    "default": ft.colors.GREY_500,
}

async def HomeView(page: ft.Page, api_client: APIClient):
    
    # 1. Fetch data
    try:
        txns_response = await api_client.get("/transactions", {"limit": 100})
        transactions = txns_response.get("items", [])
    except Exception as e:
        print(f"Error fetching transactions: {e}")
        transactions = []
        
    try:
        categories_resp = await api_client.get("/categories")
        categories_map = {c["id"]: c["name"] for c in categories_resp}
    except Exception:
        categories_map = {}

    # 2. Aggregate data for the pie chart
    total_spent = 0
    category_totals = {}
    
    for t in transactions:
        if t["direction"] == "debit":
            total_spent += t["amount"]
            cat_name = categories_map.get(t["category_id"], "Unknown")
            category_totals[cat_name] = category_totals.get(cat_name, 0) + t["amount"]

    # 3. Build Pie Chart sections
    chart_sections = []
    if not category_totals:
        chart_sections.append(
            ft.PieChartSection(100, color=ft.colors.GREY_800, radius=25)
        )
    else:
        for cat_name, amt in category_totals.items():
            color = CATEGORY_COLORS.get(cat_name.lower(), CATEGORY_COLORS["default"])
            pct = (amt / total_spent) * 100
            chart_sections.append(
                ft.PieChartSection(pct, color=color, radius=25)
            )

    # 4. Top section (Dark, Donut Chart)
    chart_stack = ft.Stack(
        controls=[
            ft.PieChart(
                sections=chart_sections,
                sections_space=2,
                center_space_radius=90,
                expand=True,
            ),
            ft.Container(
                content=ft.Column(
                    [
                        ft.Text("Rs", size=16, color=ft.colors.WHITE70),
                        ft.Text(f"{total_spent:,.0f}", size=28, weight=ft.FontWeight.BOLD, color=ft.colors.WHITE),
                    ],
                    alignment=ft.MainAxisAlignment.CENTER,
                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                    spacing=0,
                ),
                alignment=ft.alignment.center,
                expand=True,
            )
        ],
        width=250,
        height=250,
    )

    top_section = ft.Container(
        content=ft.Column(
            [
                ft.Text("Monthly", size=24, color=ft.colors.WHITE),
                ft.Text("Expenses", size=24, color=ft.colors.ORANGE_400),
                ft.Container(height=20),
                chart_stack,
            ],
            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
        ),
        padding=ft.padding.only(top=40, bottom=40),
        alignment=ft.alignment.center,
        bgcolor="#121212"
    )

    # 5. Bottom section (White card, recent transactions)
    recent_list = ft.ListView(spacing=15, padding=20, expand=True)
    
    for t in transactions[:10]:
        cat_name = categories_map.get(t["category_id"], "Unknown")
        color = CATEGORY_COLORS.get(cat_name.lower(), CATEGORY_COLORS["default"])
        
        prefix = "- " if t["direction"] == "debit" else "+ "
        amt_str = f"{prefix}Rs. {t['amount']:,.0f}"
        amt_color = ft.colors.GREY_700 if t["direction"] == "debit" else ft.colors.GREEN_600
        
        recent_list.controls.append(
            ft.Row(
                controls=[
                    ft.Container(
                        width=16, height=16, 
                        bgcolor=color, 
                        border_radius=4
                    ),
                    ft.Text(t["merchant_name"] or "Unknown", size=14, color=ft.colors.BLACK87, expand=True),
                    ft.Container(
                        content=ft.Text(amt_str, size=12, color=amt_color),
                        bgcolor=ft.colors.GREY_100,
                        padding=ft.padding.symmetric(horizontal=8, vertical=4),
                        border_radius=12
                    )
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                vertical_alignment=ft.CrossAxisAlignment.CENTER,
            )
        )
        
    recent_list.controls.append(
        ft.Container(
            content=ft.ElevatedButton(
                "Show More",
                style=ft.ButtonStyle(
                    bgcolor=ft.colors.BLACK,
                    color=ft.colors.WHITE,
                    shape=ft.RoundedRectangleBorder(radius=8),
                ),
                width=200,
                on_click=lambda _: page.go("/expenses")
            ),
            alignment=ft.alignment.center,
            padding=ft.padding.only(top=10, bottom=20)
        )
    )

    bottom_section = ft.Container(
        content=recent_list,
        bgcolor=ft.colors.WHITE,
        border_radius=ft.border_radius.only(topLeft=30, topRight=30),
        expand=True,
    )

    # 6. Assemble View
    return ft.View(
        "/home",
        controls=[
            ft.Column(
                [
                    top_section,
                    bottom_section,
                ],
                spacing=0,
                expand=True,
            )
        ],
        padding=0,
        bgcolor="#121212",
    )
