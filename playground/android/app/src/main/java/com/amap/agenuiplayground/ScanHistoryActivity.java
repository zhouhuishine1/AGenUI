package com.amap.agenuiplayground;

import android.content.Intent;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.core.view.GravityCompat;
import androidx.drawerlayout.widget.DrawerLayout;

import com.amap.agenuiplayground.adapter.ScanHistoryAdapter;
import com.amap.agenuiplayground.adapter.ComponentAdapter;
import com.amap.agenuiplayground.story.ComponentStory;
import com.amap.agenuiplayground.story.StoryLoader;
import com.amap.agenuiplayground.story.SubStory;
import com.google.android.material.navigation.NavigationView;
import com.google.android.material.appbar.MaterialToolbar;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Home screen of the Playground: lists scanned sessions (newest first) with
 * their Session name and saved time. Long-press (or the toolbar Edit button)
 * enters multi-select mode exposing a bottom Delete toolbar.
 */
public class ScanHistoryActivity extends AppCompatActivity implements ScanHistoryAdapter.Listener {

    private RecyclerView rvHistory;
    private TextView tvEmpty;
    private View bottomBar;
    private Button btnDelete;
    private ScanHistoryAdapter adapter;
    private List<ScanHistoryStore.ScanHistoryItem> items;
    private boolean editing = false;
    private final Set<String> selectedIds = new HashSet<>();
    private MenuItem editMenuItem;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_scan_history);

        MaterialToolbar toolbar = findViewById(R.id.scanHistoryToolbar);
        setSupportActionBar(toolbar);
        toolbar.setNavigationIcon(R.drawable.ic_menu);
        DrawerLayout drawer = findViewById(R.id.scanHistoryDrawer);
        drawer.setDrawerLockMode(DrawerLayout.LOCK_MODE_UNLOCKED, GravityCompat.START);
        toolbar.setNavigationOnClickListener(v -> drawer.openDrawer(GravityCompat.START));
        MenuItem scanItem = toolbar.getMenu().findItem(R.id.action_scan);
        if (scanItem != null) {
            scanItem.setShowAsAction(MenuItem.SHOW_AS_ACTION_ALWAYS);
        }
        toolbar.setOnMenuItemClickListener(item -> {
            if (item.getItemId() == R.id.action_scan) {
                scanTapped();
                return true;
            }
            if (item.getItemId() == R.id.action_edit) {
                setEditing(!editing);
                return true;
            }
            return false;
        });
        NavigationView navigation = findViewById(R.id.navigationView);
        RecyclerView componentList = navigation.findViewById(R.id.rvComponentList);
        ComponentAdapter componentAdapter = new ComponentAdapter();
        componentList.setLayoutManager(new LinearLayoutManager(this));
        componentList.setAdapter(componentAdapter);
        componentAdapter.setStories(new StoryLoader(this).loadAllStories());
        componentAdapter.setOnItemClickListener(new ComponentAdapter.OnItemClickListener() {
            @Override public void onParentClick(ComponentStory story) {
                openStory(drawer, story.getComponentName(), story.getComponentsString(), story.getDataModelString());
            }
            @Override public void onChildClick(SubStory story) {
                openStory(drawer, story.getParentName() + " / " + story.getDisplayName(), story.getComponentsString(), story.getDataModelString());
            }
        });
        navigation.findViewById(R.id.customComponentMenuItem).setOnClickListener(v ->
            openPlaygroundAction(drawer, A2UIPlaygroundActivity.EXTRA_OPEN_EDITOR));
        navigation.findViewById(R.id.a2uiShowAllMenuItem).setOnClickListener(v ->
            openPlaygroundAction(drawer, A2UIPlaygroundActivity.EXTRA_LOAD_A2UI_SHOW_ALL));
        navigation.findViewById(R.id.galleryLoadAllMenuItem).setOnClickListener(v ->
            openPlaygroundAction(drawer, A2UIPlaygroundActivity.EXTRA_LOAD_GALLERY_ALL));

        rvHistory = findViewById(R.id.rvScanHistory);
        tvEmpty = findViewById(R.id.tvScanEmpty);
        bottomBar = findViewById(R.id.scanBottomBar);
        btnDelete = findViewById(R.id.btnScanDelete);

        rvHistory.setLayoutManager(new LinearLayoutManager(this));
        adapter = new ScanHistoryAdapter(this);
        rvHistory.setAdapter(adapter);

        btnDelete.setOnClickListener(v -> deleteSelected());

        reload();
    }

    private void openStory(DrawerLayout drawer, String title, String components, String dataModel) {
        drawer.closeDrawer(GravityCompat.START);
        Intent intent = new Intent(this, A2UIPlaygroundActivity.class);
        intent.putExtra(A2UIPlaygroundActivity.EXTRA_SESSION_NAME, title);
        intent.putExtra(A2UIPlaygroundActivity.EXTRA_STORY_COMPONENTS_JSON, components);
        intent.putExtra(A2UIPlaygroundActivity.EXTRA_STORY_DATA_MODEL_JSON, dataModel);
        startActivity(intent);
    }

    private void openPlaygroundAction(DrawerLayout drawer, String actionExtra) {
        drawer.closeDrawer(GravityCompat.START);
        Intent intent = new Intent(this, A2UIPlaygroundActivity.class);
        intent.putExtra(actionExtra, true);
        startActivity(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Refresh when returning from the preview so a new scan shows up.
        reload();
    }

    private void reload() {
        items = ScanHistoryStore.load(this);
        adapter.setItems(items);
        tvEmpty.setVisibility(items.isEmpty() ? View.VISIBLE : View.GONE);
        updateUi();
    }

    private void updateUi() {
        bottomBar.setVisibility(editing ? View.VISIBLE : View.GONE);
        btnDelete.setEnabled(!selectedIds.isEmpty());
        btnDelete.setAlpha(btnDelete.isEnabled() ? 1f : 0.4f);
        adapter.setEditing(editing, selectedIds);
    }

    private void setEditing(boolean value) {
        editing = value;
        if (!value) {
            selectedIds.clear();
        }
        if (editMenuItem != null) {
            editMenuItem.setTitle(value ? R.string.scan_history_done : R.string.scan_history_edit);
        }
        updateUi();
    }

    @Override
    public void onItemClick(int position) {
        ScanHistoryStore.ScanHistoryItem item = items.get(position);
        if (editing) {
            if (selectedIds.contains(item.sessionId)) {
                selectedIds.remove(item.sessionId);
            } else {
                selectedIds.add(item.sessionId);
            }
            updateUi();
        } else {
            openItem(item);
        }
    }

    @Override
    public void onItemLongClick(int position) {
        if (!editing) {
            setEditing(true);
        }
        selectedIds.add(items.get(position).sessionId);
        updateUi();
    }

    private void openItem(ScanHistoryStore.ScanHistoryItem item) {
        Intent intent = new Intent(this, A2UIPlaygroundActivity.class);
        intent.putExtra(A2UIPlaygroundActivity.EXTRA_SESSION_NAME, item.name);
        intent.putExtra(A2UIPlaygroundActivity.EXTRA_CREATE_SURFACE_JSON, item.createSurfaceJson);
        intent.putExtra(A2UIPlaygroundActivity.EXTRA_UPDATE_COMPONENTS_JSON, item.updateComponentsJson);
        intent.putExtra(A2UIPlaygroundActivity.EXTRA_UPDATE_DATA_MODEL_JSON, item.updateDataModelJson);
        startActivity(intent);
    }

    private void scanTapped() {
        Intent intent = new Intent(this, A2UIPlaygroundActivity.class);
        intent.putExtra(A2UIPlaygroundActivity.EXTRA_LAUNCH_SCAN, true);
        startActivity(intent);
    }

    private void deleteSelected() {
        if (selectedIds.isEmpty()) {
            return;
        }
        ScanHistoryStore.delete(this, selectedIds);
        selectedIds.clear();
        setEditing(false);
        reload();
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.menu_scan_history, menu);
        MenuItem scanItem = menu.findItem(R.id.action_scan);
        if (scanItem != null) {
            scanItem.setShowAsAction(MenuItem.SHOW_AS_ACTION_ALWAYS);
        }
        editMenuItem = menu.findItem(R.id.action_edit);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        int id = item.getItemId();
        if (id == R.id.action_scan) {
            scanTapped();
            return true;
        } else if (id == R.id.action_edit) {
            setEditing(!editing);
            return true;
        }
        return super.onOptionsItemSelected(item);
    }
}
