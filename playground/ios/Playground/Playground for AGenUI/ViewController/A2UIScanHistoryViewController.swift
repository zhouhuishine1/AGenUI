//
//  A2UIScanHistoryViewController.swift
//  Playground
//
//  Created on 2026/8/16.
//

import UIKit

/// Home screen: lists previously scanned sessions, supports multi-select
/// deletion, and launches the QR scanner / preview.
final class A2UIScanHistoryViewController: UIViewController {

    private var items: [ScanHistoryItem] = []
    private var isEditing = false
    private var selectedSessionIds = Set<String>()

    private let tableView = UITableView(frame: .zero, style: .plain)
    private let emptyLabel = UILabel()

    private let bottomBar = UIView()
    private let deleteButton = UIButton(type: .system)
    private var bottomBarHeightConstraint: NSLayoutConstraint!

    private var editBarButtonItem: UIBarButtonItem!
    private var scanBarButtonItem: UIBarButtonItem!

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "A2UI体验"
        view.backgroundColor = .systemBackground

        setupTableView()
        setupEmptyState()
        setupBottomBar()
        setupNavigationBar()

        reload()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        reload()
    }

    // MARK: - Setup

    private func setupNavigationBar() {
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            image: UIImage(systemName: "line.3.horizontal"),
            style: .plain,
            target: self,
            action: #selector(menuTapped)
        )
        editBarButtonItem = UIBarButtonItem(
            title: "编辑",
            style: .plain,
            target: self,
            action: #selector(editTapped)
        )
        scanBarButtonItem = UIBarButtonItem(
            image: UIImage(systemName: "qrcode.viewfinder"),
            style: .plain,
            target: self,
            action: #selector(scanTapped)
        )
        scanBarButtonItem.accessibilityLabel = "扫描二维码"
        navigationItem.rightBarButtonItems = [editBarButtonItem, scanBarButtonItem]
    }

    private func setupTableView() {
        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.dataSource = self
        tableView.delegate = self
        tableView.register(ScanHistoryCell.self, forCellReuseIdentifier: ScanHistoryCell.reuseIdentifier)
        view.addSubview(tableView)

        let longPress = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress(_:)))
        tableView.addGestureRecognizer(longPress)

        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    private func setupEmptyState() {
        emptyLabel.translatesAutoresizingMaskIntoConstraints = false
        emptyLabel.text = "扫描二维码以开启体验"
        emptyLabel.textColor = .secondaryLabel
        emptyLabel.textAlignment = .center
        emptyLabel.font = .systemFont(ofSize: 16)
        view.addSubview(emptyLabel)

        NSLayoutConstraint.activate([
            emptyLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            emptyLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }

    private func setupBottomBar() {
        bottomBar.translatesAutoresizingMaskIntoConstraints = false
        bottomBar.backgroundColor = .systemBackground
        view.addSubview(bottomBar)

        deleteButton.setTitle("删除", for: .normal)
        deleteButton.setTitleColor(.white, for: .normal)
        deleteButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .medium)
        deleteButton.backgroundColor = .systemRed
        deleteButton.layer.cornerRadius = 8
        deleteButton.translatesAutoresizingMaskIntoConstraints = false
        deleteButton.addTarget(self, action: #selector(deleteTapped), for: .touchUpInside)
        bottomBar.addSubview(deleteButton)

        let divider = UIView()
        divider.translatesAutoresizingMaskIntoConstraints = false
        divider.backgroundColor = .separator
        bottomBar.addSubview(divider)

        bottomBarHeightConstraint = bottomBar.heightAnchor.constraint(equalToConstant: 64)

        NSLayoutConstraint.activate([
            bottomBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bottomBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bottomBar.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            bottomBarHeightConstraint,

            divider.topAnchor.constraint(equalTo: bottomBar.topAnchor),
            divider.leadingAnchor.constraint(equalTo: bottomBar.leadingAnchor),
            divider.trailingAnchor.constraint(equalTo: bottomBar.trailingAnchor),
            divider.heightAnchor.constraint(equalToConstant: 0.5),

            deleteButton.topAnchor.constraint(equalTo: bottomBar.topAnchor, constant: 10),
            deleteButton.trailingAnchor.constraint(equalTo: bottomBar.trailingAnchor, constant: -16),
            deleteButton.bottomAnchor.constraint(equalTo: bottomBar.bottomAnchor, constant: -10),
            deleteButton.widthAnchor.constraint(equalToConstant: 120)
        ])

        bottomBar.isHidden = true
    }

    // MARK: - Data

    private func reload() {
        items = ScanHistoryStore.shared.loadItems()
        tableView.reloadData()
        emptyLabel.isHidden = !items.isEmpty
        updateBottomBar()
    }

    private func updateBottomBar() {
        bottomBar.isHidden = !isEditing
        deleteButton.isEnabled = !selectedSessionIds.isEmpty
        deleteButton.alpha = deleteButton.isEnabled ? 1.0 : 0.4
        tableView.contentInset.bottom = isEditing ? 80 : 0
    }

    // MARK: - Actions

    @objc private func menuTapped() {
        let menu = A2UIPlaygroundMenuViewController()
        menu.modalPresentationStyle = .fullScreen
        menu.onTemplateSelected = { [weak self] title, components, dataModel in
            let playground = A2UIPlaygroundViewController()
            playground.entrySessionName = title
            playground.entryComponentsJson = components
            playground.entryUpdateDataModelJson = dataModel
            self?.navigationController?.pushViewController(playground, animated: true)
        }
        present(menu, animated: true)
    }

    @objc private func scanTapped() {
        let playground = A2UIPlaygroundViewController()
        playground.launchScannerOnAppear = true
        navigationController?.pushViewController(playground, animated: true)
    }

    @objc private func editTapped() {
        setEditing(!isEditing)
    }

    private func setEditing(_ editing: Bool) {
        isEditing = editing
        if !editing {
            selectedSessionIds.removeAll()
        }
        editBarButtonItem.title = editing ? "完成" : "编辑"
        tableView.reloadData()
        updateBottomBar()
    }

    @objc private func handleLongPress(_ gesture: UILongPressGestureRecognizer) {
        guard gesture.state == .began, !isEditing else { return }
        let point = gesture.location(in: tableView)
        if let indexPath = tableView.indexPathForRow(at: point) {
            setEditing(true)
            selectedSessionIds.insert(items[indexPath.row].sessionId)
            tableView.reloadData()
            updateBottomBar()
        }
    }

    @objc private func deleteTapped() {
        guard !selectedSessionIds.isEmpty else { return }
        items = ScanHistoryStore.shared.delete(sessionIds: selectedSessionIds)
        selectedSessionIds.removeAll()
        setEditing(false)
        reload()
    }

    private func openItem(_ item: ScanHistoryItem) {
        let playground = A2UIPlaygroundViewController()
        playground.entrySessionName = item.name
        playground.entryCreateSurfaceJson = item.createSurfaceJson
        playground.entryUpdateComponentsJson = item.updateComponentsJson
        playground.entryUpdateDataModelJson = item.updateDataModelJson
        navigationController?.pushViewController(playground, animated: true)
    }
}

// MARK: - UITableViewDataSource / UITableViewDelegate

extension A2UIScanHistoryViewController: UITableViewDataSource, UITableViewDelegate {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return items.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: ScanHistoryCell.reuseIdentifier, for: indexPath)
        let item = items[indexPath.row]
        cell.textLabel?.text = item.name
        cell.detailTextLabel?.text = item.formattedTime
        cell.accessoryType = isEditing
            ? (selectedSessionIds.contains(item.sessionId) ? .checkmark : .none)
            : .disclosureIndicator
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let item = items[indexPath.row]
        if isEditing {
            if selectedSessionIds.contains(item.sessionId) {
                selectedSessionIds.remove(item.sessionId)
            } else {
                selectedSessionIds.insert(item.sessionId)
            }
            tableView.reloadRows(at: [indexPath], with: .none)
            updateBottomBar()
        } else {
            openItem(item)
        }
    }
}

/// Simple subtitle cell used by the history list.
final class ScanHistoryCell: UITableViewCell {
    static let reuseIdentifier = "ScanHistoryCell"

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: .subtitle, reuseIdentifier: reuseIdentifier)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}
