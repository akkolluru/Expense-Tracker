import flet as ft

from ui.api_client import APIClient

# Helper mapping for category colors
CATEGORY_COLORS = {
    "food": ft.Colors.YELLOW_600,
    "travel": ft.Colors.BLUE_500,
    "shopping": ft.Colors.PINK_400,
    "utilities": ft.Colors.GREEN_500,
    "housing": ft.Colors.ORANGE_500,
    "default": ft.Colors.GREY_500,
}

async def HomeView(page: ft.Page, api_client: APIClient):
    
    # State
    current_range = "1M"
    summary_data = {}
    stats_data = {}
    transactions = []
    categories_map = {}
    
    # UI Elements references
    chart_stack = ft.Stack(width=250, height=250)
    total_text = ft.Text("0", size=28, weight=ft.FontWeight.BOLD, color=ft.Colors.WHITE)
    recent_list = ft.ListView(spacing=15, padding=20, expand=True)
    stats_column = ft.Column(spacing=10, expand=True)

    async def load_data():
        nonlocal summary_data, stats_data, transactions, categories_map
        try:
            # 1. Fetch Analytics data based on current range
            summary_data = await api_client.get("/analytics/spending-summary", {"range": current_range})
            
            # 2. Fetch Categorization Stats
            stats_data = await api_client.get("/analytics/categorization-stats")
            
            # 3. Fetch recent transactions
            txns_response = await api_client.get("/transactions", {"limit": 10})
            transactions = txns_response.get("items", [])
            
            # 4. Fetch categories map
            categories_resp = await api_client.get("/categories")
            categories_map = {c["id"]: c["name"] for c in categories_resp}
            
            render_ui()
        except Exception as e:
            print(f"Error fetching analytics data: {e}")

    def render_ui():
        # Update Chart
        chart_sections = []
        breakdown = summary_data.get("breakdown", [])
        
        if not breakdown:
            chart_sections.append(
                ft.PieChartSection(100, color=ft.Colors.GREY_800, radius=25)
            )
        else:
            for item in breakdown:
                color = CATEGORY_COLORS.get(item["category_name"].lower(), CATEGORY_COLORS["default"])
                total = summary_data.get("total_debit", 1)
                # Avoid division by zero
                if total == 0: total = 1
                pct = (item["amount"] / total) * 100
                chart_sections.append(
                    ft.PieChartSection(pct, color=color, radius=25)
                )
                
        chart_stack.controls.clear()
        chart_stack.controls.extend([
            ft.PieChart(
                sections=chart_sections,
                sections_space=2,
                center_space_radius=90,
                expand=True,
            ),
            ft.Container(
                content=ft.Column(
                    [
                        ft.Text("Rs", size=16, color=ft.Colors.WHITE70),
                        total_text,
                    ],
                    alignment=ft.MainAxisAlignment.CENTER,
                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                    spacing=0,
                ),
                alignment=ft.Alignment(0, 0),
                expand=True,
            )
        ])
        
        total_text.value = f"{summary_data.get('total_debit', 0):,.0f}"

        # Update Recent Transactions
        recent_list.controls.clear()
        recent_list.controls.append(
            ft.Text("Recent Transactions", size=18, weight=ft.FontWeight.BOLD, color=ft.Colors.BLACK)
        )
        for t in transactions[:5]:
            cat_name = categories_map.get(t["category_id"], "Unknown")
            color = CATEGORY_COLORS.get(cat_name.lower(), CATEGORY_COLORS["default"])
            
            prefix = "- " if t["direction"] == "debit" else "+ "
            amt_str = f"{prefix}Rs. {t['amount']:,.0f}"
            amt_color = ft.Colors.GREY_700 if t["direction"] == "debit" else ft.Colors.GREEN_600
            
            recent_list.controls.append(
                ft.Row(
                    controls=[
                        ft.Container(
                            width=16, height=16, 
                            bgcolor=color, 
                            border_radius=4
                        ),
                        ft.Text(t["merchant_name"] or "Unknown", size=14, color=ft.Colors.BLACK87, expand=True),
                        ft.Container(
                            content=ft.Text(amt_str, size=12, color=amt_color),
                            bgcolor=ft.Colors.GREY_100,
                            padding=ft.Padding(left=8, top=4, right=8, bottom=4),
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
                    "Show All",
                    style=ft.ButtonStyle(
                        bgcolor=ft.Colors.BLACK,
                        color=ft.Colors.WHITE,
                        shape=ft.RoundedRectangleBorder(radius=8),
                    ),
                    width=200,
                    on_click=lambda _: page.go("/expenses")
                ),
                alignment=ft.Alignment(0, 0),
                padding=ft.Padding(left=0, top=10, right=0, bottom=10)
            )
        )

        # Update Categorization Stats
        stats = stats_data.get("stats", [])
        stats_column.controls.clear()
        stats_column.controls.append(
            ft.Text("Categorization Pipeline", size=18, weight=ft.FontWeight.BOLD, color=ft.Colors.BLACK)
        )
        if not stats:
            stats_column.controls.append(ft.Text("No stats available", color=ft.Colors.GREY_500))
        else:
            for s in stats:
                source = str(s["source"]).capitalize()
                stats_column.controls.append(
                    ft.Row(
                        [
                            ft.Text(f"{source}", color=ft.Colors.BLACK87, expand=True),
                            ft.Text(f"{s['percentage']:.1f}%", color=ft.Colors.BLACK, weight=ft.FontWeight.BOLD),
                        ],
                        alignment=ft.MainAxisAlignment.SPACE_BETWEEN
                    )
                )
        
        stats_column.controls.append(
            ft.Container(
                content=ft.TextButton(
                    "Review Misclassified",
                    style=ft.ButtonStyle(color=ft.Colors.BLUE_700),
                    on_click=lambda _: page.go("/inbox")
                ),
                alignment=ft.Alignment(0, 0)
            )
        )
            
        page.update()

    def on_range_change(e):
        nonlocal current_range
        current_range = e.control.data
        for btn in range_buttons:
            if btn.data == current_range:
                btn.style.bgcolor = ft.Colors.CYAN_700
                btn.style.color = ft.Colors.WHITE
            else:
                btn.style.bgcolor = ft.Colors.TRANSPARENT
                btn.style.color = ft.Colors.WHITE70
        page.run_task(load_data)
        
    range_buttons = [
        ft.ElevatedButton(
            "1W", data="1W", on_click=on_range_change,
            style=ft.ButtonStyle(bgcolor=ft.Colors.TRANSPARENT, color=ft.Colors.WHITE70, shape=ft.RoundedRectangleBorder(radius=20))
        ),
        ft.ElevatedButton(
            "1M", data="1M", on_click=on_range_change,
            style=ft.ButtonStyle(bgcolor=ft.Colors.CYAN_700, color=ft.Colors.WHITE, shape=ft.RoundedRectangleBorder(radius=20))
        ),
        ft.ElevatedButton(
            "3M", data="3M", on_click=on_range_change,
            style=ft.ButtonStyle(bgcolor=ft.Colors.TRANSPARENT, color=ft.Colors.WHITE70, shape=ft.RoundedRectangleBorder(radius=20))
        ),
        ft.ElevatedButton(
            "1Y", data="1Y", on_click=on_range_change,
            style=ft.ButtonStyle(bgcolor=ft.Colors.TRANSPARENT, color=ft.Colors.WHITE70, shape=ft.RoundedRectangleBorder(radius=20))
        ),
    ]

    range_selector = ft.Row(
        controls=range_buttons,
        alignment=ft.MainAxisAlignment.CENTER,
        spacing=5
    )

    # Assemble View
    top_section = ft.Container(
        content=ft.Column(
            [
                ft.Text("Analytics", size=24, color=ft.Colors.WHITE),
                range_selector,
                ft.Container(height=10),
                chart_stack,
            ],
            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
        ),
        padding=ft.Padding(left=0, top=40, right=0, bottom=20),
        alignment=ft.Alignment(0, 0),
        bgcolor="#121212"
    )

    bottom_section = ft.Container(
        content=ft.Column(
            [
                recent_list,
                ft.Divider(color=ft.Colors.GREY_300),
                ft.Container(
                    content=stats_column,
                    padding=20
                )
            ],
            spacing=0,
            expand=True
        ),
        bgcolor=ft.Colors.WHITE,
        border_radius=ft.BorderRadius(top_left=30, top_right=30, bottom_left=0, bottom_right=0),
        expand=True,
    )

    page.run_task(load_data)

    return ft.View(
        route="/home",
        controls=[
            ft.Column(
                [
                    top_section,
                    bottom_section,
                ],
                spacing=0,
                expand=True,
                scroll=ft.ScrollMode.AUTO,
            )
        ],
        padding=0,
        bgcolor="#121212",
    )
