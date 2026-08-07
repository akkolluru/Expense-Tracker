import flet as ft
from ui.api_client import APIClient

async def InboxView(page: ft.Page, api_client: APIClient):
    
    # State
    transactions = []
    categories = []
    
    # UI Elements
    list_view = ft.ListView(spacing=10, expand=True)
    
    # Dialog Elements
    selected_txn_id = None
    cat_dropdown = ft.Dropdown(label="Category", width=250)
    subcat_dropdown = ft.Dropdown(label="Sub-Category", width=250, disabled=True)
    create_rule_checkbox = ft.Checkbox(label="Create rule for this merchant", value=True)
    
    async def load_data():
        nonlocal transactions, categories
        try:
            txns_resp = await api_client.get("/inbox/pending", {"limit": 50})
            transactions = txns_resp.get("items", [])
            categories = await api_client.get("/categories/tree")
            
            # Populate category dropdown
            cat_dropdown.options = [ft.dropdown.Option(str(c["id"]), c["name"]) for c in categories]
            render_list()
        except Exception as e:
            print(f"Error loading inbox: {e}")

    def render_list():
        list_view.controls.clear()
        if not transactions:
            list_view.controls.append(
                ft.Container(
                    content=ft.Text("No pending transactions!", color=ft.colors.WHITE54),
                    alignment=ft.alignment.center,
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
                                    ft.Text(t["merchant_name"] or t["vpa"] or "Unknown", weight=ft.FontWeight.BOLD, color=ft.colors.WHITE),
                                    ft.Text(t["date_str"] if "date_str" in t else str(t["timestamp"])[:10], size=12, color=ft.colors.WHITE54),
                                ]
                            ),
                            ft.Row(
                                [
                                    ft.Text(f"₹{t['amount']:,.0f}", color=ft.colors.RED_400 if t["direction"] == "debit" else ft.colors.GREEN_400, weight=ft.FontWeight.BOLD),
                                    ft.IconButton(
                                        icon=ft.icons.CATEGORY,
                                        icon_color=ft.colors.CYAN_400,
                                        on_click=lambda e, txn_id=t["id"]: open_categorize_dialog(txn_id)
                                    )
                                ]
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

    def on_cat_change(e):
        cat_id = int(cat_dropdown.value)
        # Find children
        for c in categories:
            if c["id"] == cat_id:
                if c.get("children"):
                    subcat_dropdown.options = [ft.dropdown.Option(str(child["id"]), child["name"]) for child in c["children"]]
                    subcat_dropdown.disabled = False
                else:
                    subcat_dropdown.options = []
                    subcat_dropdown.disabled = True
                subcat_dropdown.value = None
                break
        page.update()

    cat_dropdown.on_change = on_cat_change

    def open_categorize_dialog(txn_id):
        nonlocal selected_txn_id
        selected_txn_id = txn_id
        cat_dropdown.value = None
        subcat_dropdown.value = None
        subcat_dropdown.disabled = True
        dialog.open = True
        page.update()

    async def submit_categorize(e):
        if not cat_dropdown.value:
            return
            
        payload = {
            "category_id": int(cat_dropdown.value),
            "create_rule": create_rule_checkbox.value
        }
        if subcat_dropdown.value:
            payload["sub_category_id"] = int(subcat_dropdown.value)
            
        try:
            await api_client.post(f"/inbox/categorize/{selected_txn_id}", payload)
            dialog.open = False
            await load_data()  # reload list
        except Exception as err:
            print(f"Error categorizing: {err}")
            
        page.update()

    dialog = ft.AlertDialog(
        title=ft.Text("Categorize Transaction"),
        content=ft.Column(
            [cat_dropdown, subcat_dropdown, create_rule_checkbox],
            tight=True,
            spacing=10
        ),
        actions=[
            ft.TextButton("Cancel", on_click=lambda e: setattr(dialog, 'open', False) or page.update()),
            ft.TextButton("Save", on_click=submit_categorize)
        ]
    )
    page.overlay.append(dialog)

    # Initial load
    page.run_task(load_data)

    return ft.View(
        "/inbox",
        controls=[
            ft.Container(
                content=ft.Text("Inbox", size=24, weight=ft.FontWeight.BOLD, color=ft.colors.WHITE),
                padding=ft.padding.only(left=20, top=20, bottom=10)
            ),
            ft.Container(
                content=list_view,
                padding=ft.padding.symmetric(horizontal=20),
                expand=True
            )
        ],
        bgcolor="#121212"
    )
