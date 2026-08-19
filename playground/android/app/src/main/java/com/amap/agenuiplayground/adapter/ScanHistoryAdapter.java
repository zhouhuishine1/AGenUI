package com.amap.agenuiplayground.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.amap.agenuiplayground.R;
import com.amap.agenuiplayground.ScanHistoryStore;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * RecyclerView adapter for the home-screen scan history list.
 *
 * <p>Each row shows the Session name (main title) and its saved time (subtitle).
 * In editing mode a leading checkmark reflects the row's selection state.
 */
public class ScanHistoryAdapter extends RecyclerView.Adapter<ScanHistoryAdapter.ViewHolder> {

    public interface Listener {
        void onItemClick(int position);
        void onItemLongClick(int position);
    }

    private final List<ScanHistoryStore.ScanHistoryItem> items = new ArrayList<>();
    private final Listener listener;
    private boolean editing = false;
    private Set<String> selectedIds = null;

    public ScanHistoryAdapter(Listener listener) {
        this.listener = listener;
    }

    public void setItems(List<ScanHistoryStore.ScanHistoryItem> newItems) {
        items.clear();
        if (newItems != null) {
            items.addAll(newItems);
        }
        notifyDataSetChanged();
    }

    public void setEditing(boolean editing, Set<String> selectedIds) {
        this.editing = editing;
        this.selectedIds = selectedIds;
        notifyDataSetChanged();
    }

    public ScanHistoryStore.ScanHistoryItem getItem(int position) {
        return items.get(position);
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View v = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_scan_history, parent, false);
        return new ViewHolder(v);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        ScanHistoryStore.ScanHistoryItem item = items.get(position);
        holder.tvName.setText(item.name);
        holder.tvTime.setText(ScanHistoryStore.formatTime(item.createdAt));

        boolean selected = editing && selectedIds != null && selectedIds.contains(item.sessionId);
        holder.tvCheck.setVisibility(editing ? View.VISIBLE : View.GONE);
        holder.tvCheck.setText(selected ? "✓" : "");

        holder.itemView.setOnClickListener(v -> listener.onItemClick(holder.getAdapterPosition()));
        holder.itemView.setOnLongClickListener(v -> {
            listener.onItemLongClick(holder.getAdapterPosition());
            return true;
        });
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        final TextView tvName;
        final TextView tvTime;
        final TextView tvCheck;

        ViewHolder(View itemView) {
            super(itemView);
            tvName = itemView.findViewById(R.id.tvScanName);
            tvTime = itemView.findViewById(R.id.tvScanTime);
            tvCheck = itemView.findViewById(R.id.tvScanCheck);
        }
    }
}
