import datetime

import flet as ft

from ui.api_client import APIClient


async def ExpensesView(page: ft.Page, api_client: APIClient):
    
    transactions = []
    
    # UI Elements
    list_view = ft.ListView(spacing=10, expand=True)
    
    # Manual Add Dialog Elements
    amount_field = ft.TextField(label="Amount (₹)", keyboard_type=ft.KeyboardType.NUMBER)
    direction_dropdown = ft.Dropdown(
        label="Type", 
        options=[ft.DropdownOption(key="debit", text="Expense"), ft.DropdownOption(key="credit", text="Income")],
        value="debit"
    )
    merchant_field = ft.TextField(label="Merchant / Sender")
    cat_dropdown = ft.Dropdown(label="Category")
    subcat_dropdown = ft.Dropdown(label="Sub-Category", disabled=True)
    desc_field = ft.TextField(label="Description", multiline=True)
    
    categories = []

    async def load_data():
        nonlocal transactions, categories
        try:
            # Load transactions
            txns_resp = await api_client.get("/transactions", {"limit": 100})
            transactions = txns_resp.get("items", [])
            
            # Load categories for manual add dialog
            categories = await api_client.get("/categories/tree")
            cat_dropdown.options = [ft.DropdownOption(key=str(c["id"]), text=c["name"]) for c in categories]
            
            render_list()
        except Exception as e:
            print(f"Error loading expenses: {e}")

    def render_list():
        list_view.controls.clear()
        if not transactions:
            list_view.controls.append(
                ft.Container(
                    content=ft.Text("No transactions yet!", color=ft.Colors.WHITE54),
                    alignment=ft.Alignment(0, 0),
                    padding=40
                )
            )
        else:
            for t in transactions:
                # Build dark mode rounded card
                card = ft.Container(
                    content=ft.Row(
                        [
                            ft.Column(
                                [
                                    ft.Text(t["merchant_name"] or t["vpa"] or "Manual Entry", weight=ft.FontWeight.BOLD, color=ft.Colors.WHITE),
                                    ft.Text(str(t["timestamp"])[:16], size=12, color=ft.Colors.WHITE54),
                                    ft.Text(t.get("description") or "", size=12, color=ft.Colors.GREY_500, visible=bool(t.get("description"))),
                                ]
                            ),
                            ft.Text(
                                f"₹{t['amount']:,.0f}", 
                                color=ft.Colors.RED_400 if t["direction"] == "debit" else ft.Colors.GREEN_400, 
                                weight=ft.FontWeight.BOLD
                            )
                        ],
                        alignment=ft.MainAxisAlignment.SPACE_BETWEEN
                    ),
                    bgcolor="#1E1E1E",
                    padding=15,
                    border_radius=12,
                )
                list_view.controls.append(card)
        page.update()

    # Manual Add Dialog logic
    def on_cat_change(e):
        cat_id = int(cat_dropdown.value)
        for c in categories:
            if c["id"] == cat_id:
                if c.get("children"):
                    subcat_dropdown.options = [ft.DropdownOption(key=str(child["id"]), text=child["name"]) for child in c["children"]]
                    subcat_dropdown.disabled = False
                else:
                    subcat_dropdown.options = []
                    subcat_dropdown.disabled = True
                subcat_dropdown.value = None
                break
        page.update()

    cat_dropdown.on_change = on_cat_change

    async def submit_manual_add(e):
        if not amount_field.value or not merchant_field.value or not cat_dropdown.value:
            return # Basic validation (could add error text)
            
        payload = {
            "amount": float(amount_field.value),
            "direction": direction_dropdown.value,
            "merchant_name": merchant_field.value,
            "category_id": int(cat_dropdown.value),
            "timestamp": datetime.datetime.now().isoformat(),
            "txn_type": "manual",
            "source": "manual",
            "status": "categorized",
            "categorized_by": "user"
        }
        
        if subcat_dropdown.value:
            payload["sub_category_id"] = int(subcat_dropdown.value)
        if desc_field.value:
            payload["description"] = desc_field.value
            
        try:
            await api_client.post("/transactions", payload)
            add_dialog.open = False
            
            # Reset fields
            amount_field.value = ""
            merchant_field.value = ""
            desc_field.value = ""
            cat_dropdown.value = None
            subcat_dropdown.value = None
            subcat_dropdown.disabled = True
            
            await load_data()
        except Exception as err:
            print(f"Error adding manual transaction: {err}")
            
        page.update()

    add_dialog = ft.AlertDialog(
        title=ft.Text("Add Transaction"),
        content=ft.Column(
            [
                amount_field,
                direction_dropdown,
                merchant_field,
                cat_dropdown,
                subcat_dropdown,
                desc_field
            ],
            tight=True,
            scroll=ft.ScrollMode.AUTO,
            height=400
        ),
        actions=[
            ft.TextButton("Cancel", on_click=lambda e: setattr(add_dialog, 'open', False) or page.update()),
            ft.TextButton("Save", on_click=submit_manual_add)
        ]
    )
    page.overlay.append(add_dialog)

    def open_add_dialog(e):
        add_dialog.open = True
        page.update()

    page.run_task(load_data)

    return ft.View(
        route="/expenses",
        controls=[
            ft.Container(
                content=ft.Text("All Expenses", size=24, weight=ft.FontWeight.BOLD, color=ft.Colors.WHITE),
                padding=ft.Padding(left=20, top=20, right=0, bottom=10)
            ),
            ft.Container(
                content=list_view,
                padding=ft.Padding(left=20, top=0, right=20, bottom=0),
                expand=True
            )
        ],
        floating_action_button=ft.FloatingActionButton(
            icon=ft.Icons.ADD,
            bgcolor=ft.Colors.CYAN_600,
            on_click=open_add_dialog
        ),
        bgcolor="#121212"
    )
